from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    po_number = Column(String(50), unique=True, nullable=False)
    po_date = Column(Date, nullable=False)
    expected_delivery = Column(Date)
    status = Column(String(20), default="draft")
    total_amount = Column(Numeric(12, 2))
    track_qr = Column(Boolean, default=True)          # ← NEW
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())  # already exists
    received_at = Column(DateTime, nullable=True)

class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    invoice_number = Column(String(50), nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date)
    subtotal = Column(Numeric(12, 2), nullable=False)
    cgst_amount = Column(Numeric(10, 2), default=0)
    sgst_amount = Column(Numeric(10, 2), default=0)
    igst_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)
    itc_eligible = Column(Boolean, default=True)
    payment_status = Column(String(20), default="unpaid")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())

class PurchaseLineItem(Base):
    __tablename__ = "purchase_line_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_invoice_id = Column(Integer, ForeignKey("purchase_invoices.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    quantity = Column(Numeric(10, 3), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_rate = Column(Numeric(5, 2), nullable=False)
    cgst = Column(Numeric(10, 2), default=0)
    sgst = Column(Numeric(10, 2), default=0)
    igst = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(12, 2), nullable=False)

class POLineItem(Base):
    __tablename__ = "po_line_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"))
    item_name = Column(String(200), nullable=False)
    part_code = Column(String(50), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
