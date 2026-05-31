from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class StockLedger(Base):
    __tablename__ = "stock_ledger"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    transaction_type = Column(String(30), nullable=False)
    reference_id = Column(Integer)
    reference_type = Column(String(30))
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(10, 2))
    transaction_date = Column(Date, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class PartInstance(Base):
    __tablename__ = "part_instances"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    serial_number = Column(String(50), unique=True, nullable=False)
    qr_code_data = Column(String(100))
    qr_code_image = Column(Text)
    current_status = Column(String(30), default="in_stock")
    created_at = Column(DateTime, server_default=func.now())