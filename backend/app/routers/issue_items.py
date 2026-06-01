from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.issue_item import IssueRecord, IssueItem
from app.models.item import Item          # items table
from app.models.worker import Worker
from app.models.stock import StockLedger
from datetime import date

router = APIRouter(prefix="/api/issue-items", tags=["Issue Items"])


# ---------- Schemas ----------

class IssueItemIn(BaseModel):
    stock_item_id: int
    quantity: int


class IssueRecordIn(BaseModel):
    worker_id: int
    issued_at: datetime
    items: List[IssueItemIn]


class IssueItemOut(BaseModel):
    item_name: str
    unit: str
    quantity: int

    class Config:
        from_attributes = True


class IssueRecordOut(BaseModel):
    id: int
    worker_name: str
    issued_at: datetime
    items: List[IssueItemOut]

    class Config:
        from_attributes = True


# ---------- Routes ----------

@router.post("", response_model=IssueRecordOut)
def create_issue(payload: IssueRecordIn, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == payload.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Validate stock availability first
    for item_in in payload.items:
        item = db.query(Item).filter(Item.id == item_in.stock_item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_in.stock_item_id} not found")
        if (item.current_stock or 0) < item_in.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{item.name}'. Available: {item.current_stock} {item.unit}"
            )

    # Create issue record
    record = IssueRecord(worker_id=payload.worker_id, issued_at=payload.issued_at)
    db.add(record)
    db.flush()  # get record.id before committing

    items_out = []
    for item_in in payload.items:
        item = db.query(Item).filter(Item.id == item_in.stock_item_id).first()
        item.current_stock = (item.current_stock or 0) - item_in.quantity  # deduct stock

        issue_item = IssueItem(
            issue_record_id=record.id,
            stock_item_id=item_in.stock_item_id,
            quantity=item_in.quantity,
        )
        db.add(issue_item)
        ledger_entry = StockLedger(
            company_id=item.company_id,
            item_id=item_in.stock_item_id,
            transaction_type="issue_out",
            reference_type="issue",
            quantity=item_in.quantity,
            unit_cost=0,
            transaction_date=date.today(),
        )
        db.add(ledger_entry)
        items_out.append(IssueItemOut(
            item_name=item.name,
            unit=item.unit,
            quantity=item_in.quantity,
        ))

    db.commit()

    return IssueRecordOut(
        id=record.id,
        worker_name=worker.name,
        issued_at=record.issued_at,
        items=items_out,
    )


@router.get("", response_model=List[IssueRecordOut])
def get_issues(db: Session = Depends(get_db)):
    records = db.query(IssueRecord).order_by(IssueRecord.issued_at.desc()).all()
    result = []
    for record in records:
        items_out = []
        for ii in record.items:
            item = db.query(Item).filter(Item.id == ii.stock_item_id).first()
            items_out.append(IssueItemOut(
                item_name=item.name if item else "Unknown",
                unit=item.unit if item else "",
                quantity=ii.quantity,
            ))
        result.append(IssueRecordOut(
            id=record.id,
            worker_name=record.worker.name,
            issued_at=record.issued_at,
            items=items_out,
        ))
    return result


@router.get("/{issue_id}", response_model=IssueRecordOut)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    record = db.query(IssueRecord).filter(IssueRecord.id == issue_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Issue record not found")

    items_out = []
    for ii in record.items:
        item = db.query(Item).filter(Item.id == ii.stock_item_id).first()
        items_out.append(IssueItemOut(
            item_name=item.name if item else "Unknown",
            unit=item.unit if item else "",
            quantity=ii.quantity,
        ))

    return IssueRecordOut(
        id=record.id,
        worker_name=record.worker.name,
        issued_at=record.issued_at,
        items=items_out,
    )