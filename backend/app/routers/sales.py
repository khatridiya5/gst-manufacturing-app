from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from app.database import get_db
from app.models.sales import SalesInvoice, SalesLineItem
from app.models.stock import StockLedger
from app.models.item import Item
from app.models.customer import Customer
from app.models.company import Company
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from app.services.itc import calculate_tax, is_interstate_transaction

router = APIRouter(prefix="/sales", tags=["Sales"])

# ─── SCHEMAS ─────────────────────────────────────────────────

class SalesLineItemIn(BaseModel):
    item_id: int
    quantity: Decimal
    unit_price: Decimal

class SalesInvoiceCreate(BaseModel):
    customer_id: int
    invoice_date: date
    due_date: Optional[date] = None
    line_items: List[SalesLineItemIn]

class SalesLineItemOut(BaseModel):
    id: int
    item_id: int
    quantity: Decimal
    unit_price: Decimal
    subtotal: Decimal
    tax_rate: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal
    class Config:
        from_attributes = True

class SalesInvoiceOut(BaseModel):
    id: int
    customer_id: int
    invoice_number: str
    invoice_date: date
    is_interstate: bool
    subtotal: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_amount: Decimal
    payment_status: str
    class Config:
        from_attributes = True

# ─── CREATE SALES INVOICE ─────────────────────────────────────

@router.post("/invoices", response_model=SalesInvoiceOut)
def create_sales_invoice(
    data: SalesInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "sales"))
):
    company = db.query(Company).filter(
        Company.id == current_user.company_id
    ).first()
    customer = db.query(Customer).filter(
        Customer.id == data.customer_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Detect interstate
    interstate = is_interstate_transaction(
        company.state_code,
        customer.state_code or company.state_code
    )

    # Auto-generate invoice number
    count = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id
    ).count()
    invoice_number = f"INV-{current_user.company_id}-{str(count + 1).zfill(4)}"

    subtotal = Decimal("0")
    total_cgst = Decimal("0")
    total_sgst = Decimal("0")
    total_igst = Decimal("0")
    processed_lines = []

    for li in data.line_items:
        item = db.query(Item).filter(Item.id == li.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {li.item_id} not found")

        # Check stock
        if item.current_stock < li.quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient stock for {item.name}. Available: {item.current_stock}"
            )

        line_subtotal = li.quantity * li.unit_price
        tax = calculate_tax(line_subtotal, item.tax_rate, interstate)
        line_total = line_subtotal + tax["cgst"] + tax["sgst"] + tax["igst"]

        subtotal += line_subtotal
        total_cgst += tax["cgst"]
        total_sgst += tax["sgst"]
        total_igst += tax["igst"]

        processed_lines.append({
            "item": item,
            "quantity": li.quantity,
            "unit_price": li.unit_price,
            "subtotal": line_subtotal,
            "tax": tax,
            "total": line_total
        })

    total_amount = subtotal + total_cgst + total_sgst + total_igst

    
    
    # Save invoice
    invoice = SalesInvoice(
        company_id=current_user.company_id,
        customer_id=data.customer_id,
        invoice_number=invoice_number,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        place_of_supply=customer.state_code or company.state_code,
        is_interstate=interstate,
        subtotal=subtotal,
        cgst_amount=total_cgst,
        sgst_amount=total_sgst,
        igst_amount=total_igst,
        total_amount=total_amount,
        eway_bill_required=total_amount >= 50000,
        created_by=current_user.id
    )
    db.add(invoice)
    db.flush()

    for pl in processed_lines:
        # Save line item
        line = SalesLineItem(
            sales_invoice_id=invoice.id,
            item_id=pl["item"].id,
            quantity=pl["quantity"],
            unit_price=pl["unit_price"],
            subtotal=pl["subtotal"],
            tax_rate=pl["item"].tax_rate,
            cgst=pl["tax"]["cgst"],
            sgst=pl["tax"]["sgst"],
            igst=pl["tax"]["igst"],
            total=pl["total"]
        )
        db.add(line)

        # Deduct stock
        pl["item"].current_stock -= pl["quantity"]

        # Stock ledger
        stock_out = StockLedger(
            company_id=current_user.company_id,
            item_id=pl["item"].id,
            transaction_type="sales_out",
            reference_id=invoice.id,
            reference_type="sales_invoice",
            quantity=-pl["quantity"],
            unit_cost=pl["unit_price"],
            transaction_date=data.invoice_date
        )
        db.add(stock_out)

    db.commit()
    db.refresh(invoice)
    return invoice

# ─── GET ALL INVOICES ─────────────────────────────────────────

@router.get("/invoices", response_model=List[SalesInvoiceOut])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id
    ).all()

# ─── GET SINGLE INVOICE WITH LINE ITEMS ───────────────────────

@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoice = db.query(SalesInvoice).filter(
        SalesInvoice.id == invoice_id,
        SalesInvoice.company_id == current_user.company_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    lines = db.query(SalesLineItem).filter(
        SalesLineItem.sales_invoice_id == invoice_id
    ).all()
    customer = db.query(Customer).filter(
        Customer.id == invoice.customer_id
    ).first()

    return {
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.strftime("%d-%m-%Y"),
        "customer": customer.name,
        "is_interstate": invoice.is_interstate,
        "subtotal": str(invoice.subtotal),
        "cgst": str(invoice.cgst_amount),
        "sgst": str(invoice.sgst_amount),
        "igst": str(invoice.igst_amount),
        "total": str(invoice.total_amount),
        "eway_bill_required": invoice.eway_bill_required,
        "payment_status": invoice.payment_status,
        "line_items": [{
            "item_id": l.item_id,
            "item_name": l.item.name if l.item else f"Item #{l.item_id}",
            "quantity": str(l.quantity),
            "unit_price": str(l.unit_price),
            "tax_rate": str(l.tax_rate),
            "cgst": str(l.cgst),
            "sgst": str(l.sgst),
            "igst": str(l.igst),
            "total": str(l.total)
        } for l in lines]
    }

# ─── MARK INVOICE AS PAID ─────────────────────────────────────

@router.patch("/invoices/{invoice_id}/paid", response_model=SalesInvoiceOut)
def mark_paid(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "sales"))
):
    invoice = db.query(SalesInvoice).filter(
        SalesInvoice.id == invoice_id,
        SalesInvoice.company_id == current_user.company_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.payment_status = "paid"
    db.commit()
    db.refresh(invoice)
    return invoice

# ─── SALES SUMMARY ────────────────────────────────────────────

@router.get("/summary")
def get_sales_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoices = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id
    ).all()

    total_sales = sum(i.subtotal for i in invoices)
    total_cgst = sum(i.cgst_amount for i in invoices)
    total_sgst = sum(i.sgst_amount for i in invoices)
    total_igst = sum(i.igst_amount for i in invoices)
    total_tax = total_cgst + total_sgst + total_igst
    unpaid = sum(i.total_amount for i in invoices if i.payment_status == "unpaid")

    return {
        "total_invoices": len(invoices),
        "total_sales_value": str(total_sales),
        "total_gst_collected": str(total_tax),
        "cgst_collected": str(total_cgst),
        "sgst_collected": str(total_sgst),
        "igst_collected": str(total_igst),
        "outstanding_amount": str(unpaid)
    }