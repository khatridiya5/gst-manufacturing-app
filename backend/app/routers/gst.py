from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.database import get_db
from app.models.gst import GSTReturn
from app.models.sales import SalesInvoice, SalesLineItem
from app.models.purchase import PurchaseInvoice
from app.models.item import Item
from app.models.customer import Customer
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from datetime import date

router = APIRouter(prefix="/gst", tags=["GST Compliance"])

# ─── BUILD GSTR-1 ─────────────────────────────────────────────

from datetime import date

# ─── BUILD GSTR-1 ─────────────────────────────────────────────

@router.get("/gstr1")
def build_gstr1(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoices = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id,
        SalesInvoice.invoice_date >= from_date,
        SalesInvoice.invoice_date <= to_date
    ).all()

    if not invoices:
        return {
            "message": f"No sales invoices found for {from_date} to {to_date}",
            "period": f"{from_date} to {to_date}",
            "b2b_invoices": [],
            "hsn_summary": [],
            "totals": {},
            "total_invoices": 0
        }

    b2b = []
    hsn_data = {}
    total_taxable = Decimal("0")
    total_cgst = Decimal("0")
    total_sgst = Decimal("0")
    total_igst = Decimal("0")

    for inv in invoices:
        customer = db.query(Customer).filter(Customer.id == inv.customer_id).first()
        lines = db.query(SalesLineItem).filter(SalesLineItem.sales_invoice_id == inv.id).all()

        if customer and customer.gstin:
            b2b.append({
                "customer_name": customer.name,
                "customer_gstin": customer.gstin,
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "invoice_value": str(inv.total_amount),
                "place_of_supply": inv.place_of_supply,
                "is_interstate": inv.is_interstate,
                "taxable_value": str(inv.subtotal),
                "cgst": str(inv.cgst_amount),
                "sgst": str(inv.sgst_amount),
                "igst": str(inv.igst_amount),
            })

        for line in lines:
            item = db.query(Item).filter(Item.id == line.item_id).first()
            hsn = item.hsn_code if item else "0000"
            if hsn not in hsn_data:
                hsn_data[hsn] = {
                    "hsn_code": hsn,
                    "description": item.name if item else "",
                    "uom": item.unit if item else "",
                    "total_quantity": Decimal("0"),
                    "taxable_value": Decimal("0"),
                    "cgst": Decimal("0"),
                    "sgst": Decimal("0"),
                    "igst": Decimal("0"),
                }
            hsn_data[hsn]["total_quantity"] += line.quantity
            hsn_data[hsn]["taxable_value"] += line.subtotal
            hsn_data[hsn]["cgst"] += line.cgst
            hsn_data[hsn]["sgst"] += line.sgst
            hsn_data[hsn]["igst"] += line.igst

        total_taxable += inv.subtotal
        total_cgst += inv.cgst_amount
        total_sgst += inv.sgst_amount
        total_igst += inv.igst_amount

    hsn_summary = [
        {**{k: str(v) if isinstance(v, Decimal) else v for k, v in data.items()}}
        for data in hsn_data.values()
    ]

    return {
        "return_type": "GSTR-1",
        "period": f"{from_date} to {to_date}",
        "total_invoices": len(invoices),
        "b2b_invoices": b2b,
        "hsn_summary": hsn_summary,
        "totals": {
            "total_taxable_value": str(total_taxable),
            "total_cgst": str(total_cgst),
            "total_sgst": str(total_sgst),
            "total_igst": str(total_igst),
            "total_tax": str(total_cgst + total_sgst + total_igst),
        }
    }


# ─── BUILD GSTR-3B ────────────────────────────────────────────

@router.get("/gstr3b")
def build_gstr3b(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sales = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id,
        SalesInvoice.invoice_date >= from_date,
        SalesInvoice.invoice_date <= to_date
    ).all()

    sales_cgst = sum(i.cgst_amount for i in sales)
    sales_sgst = sum(i.sgst_amount for i in sales)
    sales_igst = sum(i.igst_amount for i in sales)
    total_tax_collected = sales_cgst + sales_sgst + sales_igst

    purchases = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == current_user.company_id,
        PurchaseInvoice.invoice_date >= from_date,
        PurchaseInvoice.invoice_date <= to_date,
        PurchaseInvoice.itc_eligible == True
    ).all()

    itc_cgst = sum(i.cgst_amount for i in purchases)
    itc_sgst = sum(i.sgst_amount for i in purchases)
    itc_igst = sum(i.igst_amount for i in purchases)
    total_itc = itc_cgst + itc_sgst + itc_igst

    net_cgst = max(sales_cgst - itc_cgst, Decimal("0"))
    net_sgst = max(sales_sgst - itc_sgst, Decimal("0"))
    net_igst = max(sales_igst - itc_igst, Decimal("0"))
    net_payable = net_cgst + net_sgst + net_igst

    return {
        "return_type": "GSTR-3B",
        "period": f"{from_date} to {to_date}",
        "tax_collected": {
            "cgst": str(sales_cgst), "sgst": str(sales_sgst),
            "igst": str(sales_igst), "total": str(total_tax_collected)
        },
        "itc_available": {
            "cgst": str(itc_cgst), "sgst": str(itc_sgst),
            "igst": str(itc_igst), "total": str(total_itc)
        },
        "net_payable": {
            "cgst": str(net_cgst), "sgst": str(net_sgst),
            "igst": str(net_igst), "total": str(net_payable)
        },
        "summary": f"You collected ₹{total_tax_collected} GST and have ₹{total_itc} ITC. Net payable: ₹{net_payable}"
    }

# ─── SAVE RETURN SNAPSHOT ─────────────────────────────────────

@router.post("/save/{return_type}")
def save_return(
    return_type: str,
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    if return_type not in ["GSTR1", "GSTR3B"]:
        raise HTTPException(status_code=400, detail="Invalid return type")

    existing = db.query(GSTReturn).filter(
        GSTReturn.company_id == current_user.company_id,
        GSTReturn.return_type == return_type,
        GSTReturn.from_date == from_date,
        GSTReturn.to_date == to_date
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Return already saved for this period")

    gst_return = GSTReturn(
        company_id=current_user.company_id,
        return_type=return_type,
        from_date=from_date,
        to_date=to_date,
        status="draft"
    )
    db.add(gst_return)
    db.commit()
    db.refresh(gst_return)
    return {"message": f"{return_type} saved for {from_date} to {to_date}", "id": gst_return.id}

# ─── MARK AS FILED ────────────────────────────────────────────

@router.patch("/file/{return_id}")
def mark_filed(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    gst_return = db.query(GSTReturn).filter(
        GSTReturn.id == return_id,
        GSTReturn.company_id == current_user.company_id
    ).first()
    if not gst_return:
        raise HTTPException(status_code=404, detail="Return not found")

    gst_return.status = "filed"
    gst_return.filed_at = datetime.utcnow()
    db.commit()
    return {"message": f"{gst_return.return_type} marked as filed"}