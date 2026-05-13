from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
from app.database import get_db
from app.models.sales import SalesInvoice, SalesLineItem
from app.models.purchase import PurchaseInvoice, PurchaseLineItem
from app.models.production import ProductionOrder
from app.models.stock import StockLedger
from app.models.item import Item
from app.utils.auth import get_current_user
from app.models.user import User
from typing import Optional

router = APIRouter(prefix="/accounting", tags=["Accounting & Reports"])

# ─── P&L STATEMENT ───────────────────────────────────────────

@router.get("/pnl")
def get_pnl(
    year: int,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Profit and Loss statement — auto from sales and purchase data"""

    # Build date filter
    if month:
        date_from = f"{year}-{month:02d}-01"
        date_to = f"{year}-{month:02d}-31"
        period = f"{month:02d}/{year}"
    else:
        date_from = f"{year}-01-01"
        date_to = f"{year}-12-31"
        period = str(year)

    # Revenue from sales
    sales = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id,
        SalesInvoice.invoice_date >= date_from,
        SalesInvoice.invoice_date <= date_to
    ).all()

    total_revenue = sum(i.subtotal for i in sales)
    total_gst_collected = sum(
        i.cgst_amount + i.sgst_amount + i.igst_amount for i in sales
    )

    # Purchase costs
    purchases = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == current_user.company_id,
        PurchaseInvoice.invoice_date >= date_from,
        PurchaseInvoice.invoice_date <= date_to
    ).all()

    total_purchase_cost = sum(i.subtotal for i in purchases)
    total_itc = sum(
        i.cgst_amount + i.sgst_amount + i.igst_amount
        for i in purchases if i.itc_eligible
    )

    # Production costs
    production_orders = db.query(ProductionOrder).filter(
        ProductionOrder.company_id == current_user.company_id,
        ProductionOrder.status == "completed",
        ProductionOrder.end_date >= date_from,
        ProductionOrder.end_date <= date_to
    ).all()

    total_production_cost = sum(
        o.production_cost for o in production_orders
        if o.production_cost
    )

    # Gross profit
    gross_profit = total_revenue - total_purchase_cost - total_production_cost

    # Net GST payable
    net_gst_payable = max(total_gst_collected - total_itc, Decimal("0"))

    return {
        "period": period,
        "income": {
            "sales_revenue": str(total_revenue),
            "total_invoices": len(sales),
        },
        "expenses": {
            "raw_material_purchase": str(total_purchase_cost),
            "production_cost": str(total_production_cost),
            "total_expenses": str(total_purchase_cost + total_production_cost),
        },
        "gst": {
            "gst_collected": str(total_gst_collected),
            "itc_available": str(total_itc),
            "net_gst_payable": str(net_gst_payable),
        },
        "profit": {
            "gross_profit": str(gross_profit),
            "gross_margin": f"{(gross_profit / total_revenue * 100):.1f}%" if total_revenue else "0%",
        }
    }

# ─── OUTSTANDING PAYMENTS ────────────────────────────────────

@router.get("/outstanding")
def get_outstanding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Who owes you money (unpaid sales invoices)"""
    from app.models.customer import Customer

    unpaid = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id,
        SalesInvoice.payment_status == "unpaid"
    ).all()

    result = []
    for inv in unpaid:
        customer = db.query(Customer).filter(
            Customer.id == inv.customer_id
        ).first()
        result.append({
            "invoice_number": inv.invoice_number,
            "customer": customer.name if customer else "Unknown",
            "invoice_date": str(inv.invoice_date),
            "due_date": str(inv.due_date) if inv.due_date else None,
            "amount": str(inv.total_amount),
        })

    total_outstanding = sum(i.total_amount for i in unpaid)

    return {
        "total_outstanding": str(total_outstanding),
        "invoice_count": len(unpaid),
        "invoices": result
    }

# ─── STOCK REPORT ────────────────────────────────────────────

@router.get("/stock-report")
def get_stock_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Current stock levels for all items"""
    items = db.query(Item).filter(
        Item.company_id == current_user.company_id
    ).all()

    return [{
        "item_id": item.id,
        "name": item.name,
        "code": item.code,
        "item_type": item.item_type,
        "hsn_code": item.hsn_code,
        "unit": item.unit,
        "current_stock": str(item.current_stock),
        "tax_rate": str(item.tax_rate),
    } for item in items]

# ─── PRODUCTION COST VS SELLING PRICE ────────────────────────

@router.get("/cost-analysis")
def get_cost_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Production cost vs selling price per finished good"""
    from app.models.production import BOMHeader

    boms = db.query(BOMHeader).filter(
        BOMHeader.company_id == current_user.company_id
    ).all()

    result = []
    for bom in boms:
        fg = db.query(Item).filter(Item.id == bom.finished_good_id).first()

        # Get completed production orders for this BOM
        orders = db.query(ProductionOrder).filter(
            ProductionOrder.bom_id == bom.id,
            ProductionOrder.status == "completed"
        ).all()

        if not orders:
            continue

        total_cost = sum(o.production_cost for o in orders if o.production_cost)
        total_qty = sum(o.actual_quantity for o in orders if o.actual_quantity)
        avg_cost = total_cost / total_qty if total_qty else Decimal("0")

        # Get avg selling price from sales line items
        sales_lines = db.query(SalesLineItem).filter(
            SalesLineItem.item_id == fg.id
        ).all()

        avg_selling_price = Decimal("0")
        if sales_lines:
            avg_selling_price = sum(l.unit_price for l in sales_lines) / len(sales_lines)

        margin = avg_selling_price - avg_cost
        margin_pct = (margin / avg_selling_price * 100) if avg_selling_price else Decimal("0")

        result.append({
            "item": fg.name,
            "hsn_code": fg.hsn_code,
            "avg_production_cost": str(round(avg_cost, 2)),
            "avg_selling_price": str(round(avg_selling_price, 2)),
            "margin": str(round(margin, 2)),
            "margin_percentage": f"{margin_pct:.1f}%",
            "total_units_produced": str(total_qty),
        })

    return result

# ─── ITC UTILISATION SUMMARY ─────────────────────────────────

@router.get("/itc-utilisation")
def get_itc_utilisation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ITC available vs utilised"""
    purchases = db.query(PurchaseInvoice).filter(
        PurchaseInvoice.company_id == current_user.company_id,
        PurchaseInvoice.itc_eligible == True
    ).all()

    sales = db.query(SalesInvoice).filter(
        SalesInvoice.company_id == current_user.company_id
    ).all()

    total_itc = sum(
        i.cgst_amount + i.sgst_amount + i.igst_amount for i in purchases
    )
    total_tax_collected = sum(
        i.cgst_amount + i.sgst_amount + i.igst_amount for i in sales
    )
    itc_utilised = min(total_itc, total_tax_collected)
    itc_balance = total_itc - itc_utilised

    return {
        "total_itc_available": str(total_itc),
        "itc_utilised": str(itc_utilised),
        "itc_balance_carry_forward": str(itc_balance),
        "total_tax_collected": str(total_tax_collected),
        "net_cash_paid_to_govt": str(max(total_tax_collected - total_itc, Decimal("0")))
    }