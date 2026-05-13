from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class SalesInvoice(Base):
    __tablename__ = "sales_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"))
    invoice_number = Column(String(50), unique=True, nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date)
    place_of_supply = Column(String(2), nullable=False)
    is_interstate = Column(Boolean, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    cgst_amount = Column(Numeric(10, 2), default=0)
    sgst_amount = Column(Numeric(10, 2), default=0)
    igst_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)
    payment_status = Column(String(20), default="unpaid")
    eway_bill_required = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())

class SalesLineItem(Base):
    __tablename__ = "sales_line_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_invoice_id = Column(Integer, ForeignKey("sales_invoices.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    quantity = Column(Numeric(10, 3), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_rate = Column(Numeric(5, 2), nullable=False)
    cgst = Column(Numeric(10, 2), default=0)
    sgst = Column(Numeric(10, 2), default=0)
    igst = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)