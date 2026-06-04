from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class PaymentStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    overdue = "overdue"

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)  # "payable" or "receivable"
    party_name = Column(String)  # vendor or customer name
    party_id = Column(Integer)
    invoice_number = Column(String)
    invoice_date = Column(Date)
    due_date = Column(Date)
    total_amount = Column(Numeric(10, 2))
    paid_amount = Column(Numeric(10, 2), default=0)
    balance = Column(Numeric(10, 2))
    status = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    notes = Column(String, nullable=True)