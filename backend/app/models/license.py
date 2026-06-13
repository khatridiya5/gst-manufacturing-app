from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP, func
from sqlalchemy.orm import relationship
from app.database import Base

class License(Base):
    __tablename__ = "licenses"

    id = Column(Integer, primary_key=True, index=True)
    license_key = Column(String(50), unique=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"))
    max_devices = Column(Integer, default=2)
    valid_from = Column(TIMESTAMP, server_default=func.now())
    valid_until = Column(TIMESTAMP, nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(TIMESTAMP, server_default=func.now())

    devices = relationship("RegisteredDevice", back_populates="license", cascade="all, delete-orphan")
    company = relationship("Company")


class RegisteredDevice(Base):
    __tablename__ = "registered_devices"

    id = Column(Integer, primary_key=True, index=True)
    license_id = Column(Integer, ForeignKey("licenses.id", ondelete="CASCADE"))
    device_fingerprint = Column(String(255), nullable=False)
    device_label = Column(String(100), nullable=True)
    registered_at = Column(TIMESTAMP, server_default=func.now())
    last_seen = Column(TIMESTAMP, server_default=func.now())

    license = relationship("License", back_populates="devices")