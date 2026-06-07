from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class BOMHeader(Base):
    __tablename__ = "bom_headers"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    finished_good_id = Column(Integer, ForeignKey("items.id"))
    version = Column(String(10), default="1.0")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

class BOMLineItem(Base):
    __tablename__ = "bom_line_items"

    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("bom_headers.id"))
    raw_material_id = Column(Integer, ForeignKey("items.id"))
    quantity_required = Column(Numeric(10, 3), nullable=False)
    unit = Column(String(20), nullable=False)
    scrap_percentage = Column(Numeric(5, 2), default=0)

class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    bom_id = Column(Integer, ForeignKey("bom_headers.id"))
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)  # ← ADD THIS
    order_number = Column(String(50), unique=True, nullable=False)
    planned_quantity = Column(Numeric(10, 3), nullable=False)
    actual_quantity = Column(Numeric(10, 3))
    scrap_quantity = Column(Numeric(10, 3), default=0)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20), default="planned")
    production_cost = Column(Numeric(12, 2))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())