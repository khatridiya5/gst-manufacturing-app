from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime
from app.database import Base

class WIPScan(Base):
    __tablename__ = "wip_scans"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    worker_id = Column(Integer, ForeignKey("workers.id"))
    part_instance_id = Column(Integer, ForeignKey("part_instances.id"))
    scan_type = Column(String(20), nullable=False)
    scanned_at = Column(DateTime, default=datetime.utcnow)
    duration_minutes = Column(Integer)
    workstation = Column(String(50))
    notes = Column(Text)