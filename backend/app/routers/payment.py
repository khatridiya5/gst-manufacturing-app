from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.purchase import PurchaseInvoice, PurchaseOrder
from app.models.sales import SalesInvoice
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/payments", tags=["payments"])

@router.get("/payables")
def get_payables(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    vendors = db.query(Vendor).filter(
        Vendor.company_id == current_user.company_id,
        Vendor.is_active == True
    ).all()

    result = []
    total_payable = 0

    for vendor in vendors:
        invoices = db.query(PurchaseInvoice).filter(
            PurchaseInvoice.company_id == current_user.company_id,
            PurchaseInvoice.vendor_id == vendor.id
        ).all()

        if not invoices:
            continue

        vendor_total = sum(float(i.total_amount) for i in invoices)
        vendor_paid = sum(float(i.amount_paid or 0) for i in invoices)
        vendor_balance = vendor_total - vendor_paid

        pos = []
        for inv in invoices:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.id == inv.po_id).first()
            paid = float(inv.amount_paid or 0)
            total = float(inv.total_amount)
            balance = total - paid
            if balance <= 0:
                status = 'paid'
            elif paid > 0:
                status = 'partial'
            else:
                status = 'pending'
            pos.append({
                "invoice_no": inv.invoice_number,
                "po_number": po.po_number if po else "—",
                "invoice_date": str(inv.invoice_date),
                "total": total,
                "paid": paid,
                "balance": balance,
                "status": status,
            })

        total_payable += vendor_balance
        result.append({
            "vendor_id": vendor.id,
            "vendor": vendor.name,
            "total": vendor_total,
            "paid": vendor_paid,
            "balance": vendor_balance,
            "invoices": pos
        })

    return {"total_payable": total_payable, "items": result}


@router.get("/receivables")
def get_receivables(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    customers = db.query(Customer).filter(
        Customer.company_id == current_user.company_id,
        Customer.is_active == True
    ).all()

    result = []
    total_receivable = 0

    for customer in customers:
        invoices = db.query(SalesInvoice).filter(
            SalesInvoice.company_id == current_user.company_id,
            SalesInvoice.customer_id == customer.id
        ).all()

        if not invoices:
            continue

        cust_total = sum(float(i.total_amount) for i in invoices)
        cust_paid = sum(float(i.amount_paid or 0) for i in invoices)
        cust_balance = cust_total - cust_paid

        inv_list = []
        for inv in invoices:
            paid = float(inv.amount_paid or 0)
            total = float(inv.total_amount)
            balance = total - paid
            if balance <= 0:
                status = 'paid'
            elif paid > 0:
                status = 'partial'
            else:
                status = 'pending'
            inv_list.append({
                "invoice_no": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "total": total,
                "paid": paid,
                "balance": balance,
                "status": status,
            })

        total_receivable += cust_balance
        result.append({
            "customer_id": customer.id,
            "customer": customer.name,
            "total": cust_total,
            "paid": cust_paid,
            "balance": cust_balance,
            "invoices": inv_list
        })

    return {"total_receivable": total_receivable, "items": result}