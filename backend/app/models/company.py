from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    gstin = Column(String(15), unique=True, nullable=False)
    pan = Column(String(10))
    address = Column(Text)
    state = Column(String(50), nullable=False)
    state_code = Column(String(2), nullable=False)
    phone = Column(String(15))
    email = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())