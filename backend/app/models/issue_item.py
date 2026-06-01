from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class IssueRecord(Base):
    __tablename__ = "issue_records"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id"), nullable=False)
    issued_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    worker = relationship("Worker", back_populates="issue_records")
    items = relationship("IssueItem", back_populates="issue_record", cascade="all, delete-orphan")


class IssueItem(Base):
    __tablename__ = "issue_items"

    id = Column(Integer, primary_key=True, index=True)
    issue_record_id = Column(Integer, ForeignKey("issue_records.id"), nullable=False)
    stock_item_id = Column(Integer, ForeignKey("items.id"), nullable=False)   # items table
    quantity = Column(Integer, nullable=False)

    issue_record = relationship("IssueRecord", back_populates="items")
    stock_item = relationship("Item")