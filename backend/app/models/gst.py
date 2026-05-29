from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base

class GSTReturn(Base):
    __tablename__ = "gst_returns"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    return_type = Column(String(10), nullable=False)
    from_date = Column(Date, nullable=False)      # replaces period_month/year
    to_date = Column(Date, nullable=False)
    status = Column(String(20), default="draft")
    data = Column(JSONB)
    filed_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())