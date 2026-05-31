from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    name = Column(String(200), nullable=False)
    code = Column(String(50))
    item_type = Column(String(20))
    hsn_code = Column(String(8), nullable=False)
    unit = Column(String(20), nullable=False)
    tax_rate = Column(Numeric(5, 2), nullable=False)
    opening_stock = Column(Numeric(10, 3), default=0)
    current_stock = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())