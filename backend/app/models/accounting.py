from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    name = Column(String(100), nullable=False)
    account_type = Column(String(30), nullable=False)
    code = Column(String(20), unique=True)
    is_system = Column(Boolean, default=False)

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    entry_date = Column(Date, nullable=False)
    description = Column(Text)
    reference_type = Column(String(30))
    reference_id = Column(Integer)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())

class JournalLineItem(Base):
    __tablename__ = "journal_line_items"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"))
    ledger_account_id = Column(Integer, ForeignKey("ledger_accounts.id"))
    debit = Column(Numeric(12, 2), default=0)
    credit = Column(Numeric(12, 2), default=0)