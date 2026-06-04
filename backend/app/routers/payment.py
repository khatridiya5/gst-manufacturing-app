from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import purchase, sales, vendor, customer

router = APIRouter(prefix="/payments", tags=["payments"])

@router.get("/payables")
def get_payables(db: Session = Depends(get_db)):
    """How much you owe to suppliers for raw materials"""
    purchases = db.query(purchase.PurchaseOrder).filter(
        purchase.PurchaseOrder.payment_status != "paid"
    ).all()
    
    total_payable = sum(p.balance_due for p in purchases)
    
    return {
        "total_payable": str(total_payable),
        "count": len(purchases),
        "items": [
            {
                "vendor": p.vendor.name,
                "invoice_no": p.invoice_number,
                "invoice_date": str(p.invoice_date),
                "due_date": str(p.due_date),
                "total": str(p.total_amount),
                "paid": str(p.paid_amount),
                "balance": str(p.balance_due),
                "status": p.payment_status,
            }
            for p in purchases
        ]
    }

@router.get("/receivables")
def get_receivables(db: Session = Depends(get_db)):
    """How much customers owe you"""
    invoices = db.query(sales.SalesInvoice).filter(
        sales.SalesInvoice.payment_status != "paid"
    ).all()
    
    total_receivable = sum(i.balance_due for i in invoices)
    
    return {
        "total_receivable": str(total_receivable),
        "count": len(invoices),
        "items": [
            {
                "customer": i.customer.name,
                "invoice_no": i.invoice_number,
                "invoice_date": str(i.invoice_date),
                "due_date": str(i.due_date),
                "total": str(i.total_amount),
                "paid": str(i.paid_amount),
                "balance": str(i.balance_due),
                "status": i.payment_status,
            }
            for i in invoices
        ]
    }

@router.get("/summary")
def get_payment_summary(db: Session = Depends(get_db)):
    """Dashboard summary"""
    payables = get_payables(db)
    receivables = get_receivables(db)
    net = float(receivables["total_receivable"]) - float(payables["total_payable"])
    
    return {
        "total_payable": payables["total_payable"],
        "total_receivable": receivables["total_receivable"],
        "net_position": str(net),  # positive = you'll receive more than you pay
        "payable_count": payables["count"],
        "receivable_count": receivables["count"],
    }