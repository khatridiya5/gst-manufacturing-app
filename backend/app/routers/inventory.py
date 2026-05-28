from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item
from app.models.wip_scan import WIPScan
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.models.worker import Worker

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ─── SCHEMAS ─────────────────────────────────────────────────

class ManualStockEntry(BaseModel):
    item_id: int
    quantity: float
    reason: Optional[str] = None


# ─── IN-STORE INVENTORY ───────────────────────────────────────

@router.get("/in-store")
def get_in_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    received = (
        db.query(
            StockLedger.item_id,
            func.sum(StockLedger.quantity).label("total_received")
        )
        .filter(
            StockLedger.transaction_type.in_(["purchase_in", "manual_in"]),
            StockLedger.company_id == current_user.company_id
        )
        .group_by(StockLedger.item_id)
        .subquery()
    )

    consumed = (
        db.query(
            PartInstance.item_id,
            func.count(WIPScan.id).label("total_consumed")
        )
        .join(WIPScan, WIPScan.part_instance_id == PartInstance.id)
        .filter(
            WIPScan.scan_type == "start",
            PartInstance.company_id == current_user.company_id
        )
        .group_by(PartInstance.item_id)
        .subquery()
    )

    manual_out = (
        db.query(
            StockLedger.item_id,
            func.sum(StockLedger.quantity).label("total_manual_out")
        )
        .filter(
            StockLedger.transaction_type == "manual_out",
            StockLedger.company_id == current_user.company_id
        )
        .group_by(StockLedger.item_id)
        .subquery()
    )

    results = (
        db.query(
            Item.id,
            Item.name,
            Item.code,
            received.c.total_received,
            func.coalesce(consumed.c.total_consumed, 0).label("total_consumed"),
            func.coalesce(manual_out.c.total_manual_out, 0).label("total_manual_out"),
        )
        .join(received, received.c.item_id == Item.id)
        .outerjoin(consumed, consumed.c.item_id == Item.id)
        .outerjoin(manual_out, manual_out.c.item_id == Item.id)
        .filter(Item.company_id == current_user.company_id)
        .all()
    )

    return [
        {
            "item_id": r.id,
            "name": r.name,
            "part_code": r.code,
            "total_received": float(r.total_received),
            "total_consumed": int(r.total_consumed),
            "in_stock": float(r.total_received) - int(r.total_consumed) - float(r.total_manual_out),
            "low_stock": (
                float(r.total_received) - int(r.total_consumed) - float(r.total_manual_out)
            ) <= (float(r.total_received) * 0.1),
        }
        for r in results
    ]


# ─── MANUAL ENTRY ─────────────────────────────────────────────

@router.post("/in-store/manual-entry")
def manual_stock_entry(
    data: ManualStockEntry,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    item = db.query(Item).filter(
        Item.id == data.item_id,
        Item.company_id == current_user.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if data.quantity == 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be zero")

    transaction_type = "manual_in" if data.quantity > 0 else "manual_out"

    entry = StockLedger(
        company_id=current_user.company_id,
        item_id=data.item_id,
        transaction_type=transaction_type,
        reference_type="manual",
        quantity=abs(data.quantity),
        unit_cost=0,
        transaction_date=date.today()
    )
    db.add(entry)

    item.current_stock += data.quantity

    db.commit()
    return {
        "message": f"Stock {'added' if data.quantity > 0 else 'deducted'} successfully",
        "item": item.name,
        "quantity": abs(data.quantity),
        "type": transaction_type
    }


# ─── SCAN HISTORY ─────────────────────────────────────────────

@router.get("/in-store/{item_id}/scans")
def get_item_scan_history(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    Claude finished the responseYou said: in this is want date to be like day moth n yearimport { useEffect, useState } from "react";
import api from "../../api/client";

const LOW_STOCK_THRESHOLD = 0.1;

export default function InStore() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  pastedfrom fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item
from app.models.wip_scan import WIPScan
from app.utils.auth imppastedin this is want date to be like day moth n year1:37 PMClaude responded: Looking at the screenshot, the "Scanned At" column shows dates like 5/26/2026, 4:55:03 PM — you want it formatted as 26 May 2026, 4:55:03 PM.Looking at the screenshot, the "Scanned At" column shows dates like 5/26/2026, 4:55:03 PM — you want it formatted as 26 May 2026, 4:55:03 PM.
Just change the toLocaleString() call in the scan history table:
jsx// In the scan history table, find this line:
<td className="py-1">{new Date(s.scanned_at).toLocaleString()}</td>

// Replace with:
<td className="py-1">
  {new Date(s.scanned_at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  })}
</td>
This will render as 26 May 2026, 04:55:03 pm. If you want the AM/PM in uppercase, chain a .toUpperCase() or use hour12: false for 24-hour format — up to you.You said: In this i want workers name also to be shown tell me which else file do u needfrom fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item
from app.models.wip_scan import WIPScan
from app.utils.auth imppastedimport { useEffect, useState } from "react";
import api from "../../api/client";

const LOW_STOCK_THRESHOLD = 0.1;

export default function InStore() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  pastedIn this i want workers name also to be shown tell me which else file do u need11:20 AMClaude responded: Looking at the scan history table, the Worker column is empty because the backend returns worker_id but not the worker's name.Looking at the scan history table, the Worker column is empty because the backend returns worker_id but not the worker's name. You need to join the User or Worker model in the backend.
Tell me — which model holds worker names? Looking at your file tree I can see worker.py in models. Share these two files:

app/models/worker.py — to see the Worker model fields
app/models/wip_scan.py — to see how worker_id relates (foreign key to User or Worker?)

That's all I need to fix the backend query to join and return the name.
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    name = Column(String(100), nullable=False)
    worker_code = Column(String(20), unique=True, nullable=False)
    department = Column(String(50))
    phone = Column(String(15))
    qr_code_data = Column(String(100))
    qr_code_image = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


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
    notes = Column(Text)Show more11:21 AMClaude responded: worker_id is a FK to workers.worker_id is a FK to workers.id. So you just need to join the Worker model in the scan history query.
Backend fix — inventory.py:
python# add this import at the top
from app.models.worker import Worker

# replace the get_item_scan_history function's query and return:
rows = (
    db.query(WIPScan, PartInstance, Worker)
    .join(PartInstance, WIPScan.part_instance_id == PartInstance.id)
    .join(Worker, WIPScan.worker_id == Worker.id)        # ← add this
    .filter(
        PartInstance.item_id == item_id,
        PartInstance.company_id == current_user.company_id,
        WIPScan.scan_type == "start"
    )
    .order_by(WIPScan.scanned_at.desc())
    .limit(10)
    .all()
)

return [
    {
        "part_instance": scan.part_instance_id,
        "serial_number": instance.serial_number,
        "scanned_at": scan.scanned_at,
        "workstation": scan.workstation,
        "worker_id": scan.worker_id,
        "worker": worker.name,        # ← add this
    }
    for scan, instance, worker in rows   # ← unpack worker too
]


# ─── DEBUG ENDPOINTS ──────────────────────────────────────────

@router.get("/debug/stock-ledger")
def debug_stock(db: Session = Depends(get_db)):
    rows = db.query(StockLedger).all()
    return [
        {
            "id": r.id,
            "company_id": r.company_id,
            "item_id": r.item_id,
            "transaction_type": r.transaction_type,
            "quantity": str(r.quantity)
        }
        for r in rows
    ]


@router.get("/debug/in-store-raw")
def debug_in_store(db: Session = Depends(get_db)):
    received_rows = db.query(StockLedger).filter(
        StockLedger.transaction_type == "purchase_in"
    ).all()
    items = db.query(Item).all()
    return {
        "stock_ledger_purchase_in": [
            {"item_id": r.item_id, "company_id": r.company_id, "quantity": str(r.quantity)}
            for r in received_rows
        ],
        "items": [
            {"id": i.id, "name": i.name}
            for i in items
        ]
    }