from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from app.database import get_db
from app.models.purchase import PurchaseOrder, PurchaseInvoice, PurchaseLineItem, POLineItem
from app.models.stock import StockLedger, PartInstance
from app.models.item import Item
from app.models.vendor import Vendor
from app.models.company import Company
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from app.services.itc import calculate_tax, is_interstate_transaction
from app.services.qr import generate_qr_base64, generate_part_qr_data

router = APIRouter(prefix="/purchase", tags=["Purchase"])

# ─── SCHEMAS ─────────────────────────────────────────────────

class POLineItemIn(BaseModel):
    item_id: int
    quantity: int
    unit_price: Decimal

class POCreate(BaseModel):
    vendor_id: int
    po_date: date
    expected_delivery: Optional[date] = None
    line_items: List[POLineItemIn]

class POOut(BaseModel):
    id: int
    po_number: str
    vendor_id: int
    po_date: date
    status: str
    total_amount: Optional[Decimal]
    class Config:
        from_attributes = True

class PurchaseInvoiceOut(BaseModel):
    id: int
    vendor_id: int
    invoice_number: str
    invoice_date: date
    subtotal: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_amount: Decimal
    itc_eligible: bool
    payment_status: str
    class Config:
        from_attributes = True

# ─── CREATE PO ───────────────────────────────────────────────

@router.post("/po", response_model=POOut)
def create_po(
    data: POCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == current_user.company_id
    ).count()
    po_number = f"PO-{current_user.company_id}-{str(count + 1).zfill(4)}"
    total = sum(li.quantity * li.unit_price for li in data.line_items)

    po = PurchaseOrder(
        company_id=current_user.company_id,
        vendor_id=data.vendor_id,
        po_number=po_number,
        po_date=data.po_date,
        expected_delivery=data.expected_delivery,
        status="draft",
        total_amount=total,
        created_by=current_user.id
    )
    db.add(po)
    db.flush()

    # Save PO line items
    for li in data.line_items:
        po_line = POLineItem(
            po_id=po.id,
            item_id=li.item_id,
            quantity=li.quantity,
            unit_price=li.unit_price
        )
        db.add(po_line)

    db.commit()
    db.refresh(po)
    return po

# ─── APPROVE PO (admin only) ──────────────────────────────────

@router.patch("/po/{po_id}/approve", response_model=POOut)
def approve_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status != "draft":
        raise HTTPException(status_code=400, detail=f"PO is already {po.status}")
    po.status = "approved"
    db.commit()
    db.refresh(po)
    return po

# ─── RECEIVE PO → invoice + QR codes ─────────────────────────

@router.patch("/po/{po_id}/receive")
def receive_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status != "approved":
        raise HTTPException(status_code=400, detail="PO must be approved before receiving")

    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    vendor = db.query(Vendor).filter(Vendor.id == po.vendor_id).first()
    interstate = is_interstate_transaction(
        company.state_code,
        vendor.state_code or company.state_code
    )

    po_lines = db.query(POLineItem).filter(POLineItem.po_id == po.id).all()
    if not po_lines:
        raise HTTPException(status_code=400, detail="PO has no line items")

    subtotal = Decimal("0")
    total_cgst = Decimal("0")
    total_sgst = Decimal("0")
    total_igst = Decimal("0")
    processed_lines = []

    for li in po_lines:
        item = db.query(Item).filter(Item.id == li.item_id).first()
        line_subtotal = Decimal(li.quantity) * li.unit_price
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

    # Create invoice
    invoice = PurchaseInvoice(
        company_id=current_user.company_id,
        vendor_id=po.vendor_id,
        po_id=po.id,
        invoice_number=f"PI-{po.po_number}",
        invoice_date=date.today(),
        subtotal=subtotal,
        cgst_amount=total_cgst,
        sgst_amount=total_sgst,
        igst_amount=total_igst,
        total_amount=total_amount,
        itc_eligible=True,
        created_by=current_user.id
    )
    db.add(invoice)
    db.flush()

    all_qr_codes = []

    for pl in processed_lines:
        item = pl["item"]
        qty = int(pl["quantity"])

        # Invoice line item
        inv_line = PurchaseLineItem(
            purchase_invoice_id=invoice.id,
            item_id=item.id,
            quantity=pl["quantity"],
            unit_price=pl["unit_price"],
            subtotal=pl["subtotal"],
            tax_rate=item.tax_rate,
            cgst=pl["tax"]["cgst"],
            sgst=pl["tax"]["sgst"],
            igst=pl["tax"]["igst"],
            total=pl["total"]
        )
        db.add(inv_line)

        # Generate one QR per unit
        for unit_num in range(1, qty + 1):
            qr_data = generate_part_qr_data(
                item.item_type,
                item.code or item.name,
                po.po_number,
                unit_num
            )
            qr_image = generate_qr_base64(qr_data)
            part = PartInstance(
                company_id=current_user.company_id,
                purchase_order_id=po.id,
                item_id=item.id,
                serial_number=qr_data,
                qr_code_data=qr_data,
                qr_code_image=qr_image,
                current_status="in_stock"
            )
            db.add(part)
            all_qr_codes.append({
                "serial": qr_data,
                "item": item.name,
                "unit": unit_num
            })

        # Stock ledger
        stock_entry = StockLedger(
            company_id=current_user.company_id,
            item_id=item.id,
            transaction_type="purchase_in",
            reference_id=invoice.id,
            reference_type="purchase_invoice",
            quantity=pl["quantity"],
            unit_cost=pl["unit_price"],
            transaction_date=date.today()
        )
        db.add(stock_entry)
        item.current_stock += pl["quantity"]

    po.status = "received"
    db.commit()

    return {
        "message": "PO received successfully",
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "total_amount": str(total_amount),
        "qr_codes_generated": len(all_qr_codes),
        "parts_preview": all_qr_codes[:5],
        "note": f"{len(all_qr_codes)} QR codes generated. Fetch /purchase/po/{po_id}/qr-codes to get all with images."
    }

# ─── GET QR CODES FOR A PO ────────────────────────────────────

@router.get("/po/{po_id}/qr-codes")
def get_po_qr_codes(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    parts = db.query(PartInstance).filter(
        PartInstance.purchase_order_id == po_id,
        PartInstance.company_id == current_user.company_id
    ).all()
    return [{
        "serial_number": p.serial_number,
        "item_id": p.item_id,
        "qr_code_image": p.qr_code_image,
        "status": p.current_status
    } for p in parts]

# ─── GET ALL POs ──────────────────────────────────────────────

@router.get("/po", response_model=List[POOut])
def get_pos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(PurchaseOrder).filter(
        PurchaseOrder.company_id == current_user.company_id
    ).all()

# ─── GET ALL INVOICES ─────────────────────────────────────────

@router.get("/invoices", response_model=List[PurchaseInvoiceOut])
def get_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == current_user.company_id
    ).all()

# ─── ITC SUMMARY ─────────────────────────────────────────────

@router.get("/itc-summary")
def get_itc_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoices = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == current_user.company_id,
        PurchaseInvoice.itc_eligible == True
    ).all()
    total_cgst = sum(i.cgst_amount for i in invoices)
    total_sgst = sum(i.sgst_amount for i in invoices)
    total_igst = sum(i.igst_amount for i in invoices)
    return {
        "total_cgst_itc": total_cgst,
        "total_sgst_itc": total_sgst,
        "total_igst_itc": total_igst,
        "total_itc": total_cgst + total_sgst + total_igst
    }

# ─── DELETE PO ───────────────────────────────────────────────

@router.delete("/po/{po_id}")
def delete_po(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    po = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == po_id,
        PurchaseOrder.company_id == current_user.company_id
    ).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    
    # Delete related records first
    db.query(POLineItem).filter(POLineItem.po_id == po_id).delete()
    db.query(PartInstance).filter(PartInstance.purchase_order_id == po_id).delete()
    db.delete(po)
    db.commit()
    return {"message": "PO deleted successfully"}