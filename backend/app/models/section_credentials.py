from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class SectionCredential(Base):
    __tablename__ = "section_credentials"

    id = Column(Integer, primary_key=True, index=True)
    section = Column(String, unique=True, nullable=False)  # "purchase", "sales", "production"
    username = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)