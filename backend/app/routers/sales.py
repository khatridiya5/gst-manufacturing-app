from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
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

    # ✅ FIX: scope customer to company
    customer = db.query(Customer).filter(
        Customer.id == data.customer_id,
        Customer.company_id == current_user.company_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    interstate = is_interstate_transaction(
        company.state_code,
        customer.state_code or company.state_code
    )

    count = db.query(func.count(SalesInvoice.id)).filter(
        SalesInvoice.company_id == current_user.company_id
    ).scalar() or 0
    invoice_number = f"INV-{current_user.company_id}-{str(count + 1).zfill(4)}"

    # ✅ FIX: fetch all items in one query instead of 1 per line item
    item_ids = [li.item_id for li in data.line_items]
    items_map = {
        i.id: i for i in db.query(Item).filter(
            Item.id.in_(item_ids),
            Item.company_id == current_user.company_id  # ✅ FIX: scope to company
        ).all()
    }

    subtotal = Decimal("0")
    total_cgst = Decimal("0")
    total_sgst = Decimal("0")
    total_igst = Decimal("0")
    processed_lines = []

    for li in data.line_items:
        item = items_map.get(li.item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {li.item_id} not found")

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

        pl["item"].current_stock -= pl["quantity"]

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
    skip: int = 0,
    limit: int = 50,                              # ✅ FIX: pagination — no more loading all rows
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id
    ).order_by(SalesInvoice.invoice_date.desc()).offset(skip).limit(limit).all()

# ─── GET SINGLE INVOICE WITH LINE ITEMS ───────────────────────

@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ✅ FIX: load invoice + line_items + customer in one query
    invoice = db.query(SalesInvoice).options(
        joinedload(SalesInvoice.line_items).joinedload(SalesLineItem.item),
        joinedload(SalesInvoice.customer)
    ).filter(
        SalesInvoice.id == invoice_id,
        SalesInvoice.company_id == current_user.company_id
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return {
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.invoice_date.strftime("%d-%m-%Y"),
        "customer": invoice.customer.name,
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
        } for l in invoice.line_items]
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
    # ✅ FIX: single aggregation query — no Python-side summing of all rows
    row = db.query(
        func.coalesce(func.sum(SalesInvoice.subtotal),    Decimal("0")),
        func.coalesce(func.sum(SalesInvoice.cgst_amount), Decimal("0")),
        func.coalesce(func.sum(SalesInvoice.sgst_amount), Decimal("0")),
        func.coalesce(func.sum(SalesInvoice.igst_amount), Decimal("0")),
        func.count(SalesInvoice.id),
        func.coalesce(
            func.sum(SalesInvoice.total_amount).filter(
                SalesInvoice.payment_status == "unpaid"
            ), Decimal("0")
        )
    ).filter(
        SalesInvoice.company_id == current_user.company_id
    ).one()

    total_sales, total_cgst, total_sgst, total_igst, total_invoices, unpaid = row
    total_tax = total_cgst + total_sgst + total_igst

    return {
        "total_invoices": total_invoices,
        "total_sales_value": str(total_sales),
        "total_gst_collected": str(total_tax),
        "cgst_collected": str(total_cgst),
        "sgst_collected": str(total_sgst),
        "igst_collected": str(total_igst),
        "outstanding_amount": str(unpaid)
    }