from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item
from app.models.wip_scan import WIPScan
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from app.models.worker import Worker
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ─── SCHEMAS ─────────────────────────────────────────────────

class ManualStockEntry(BaseModel):
    item_id: int
    quantity: float
    reason: Optional[str] = None


# ─── IN-STORE INVENTORY ───────────────────────────────────────

@router.get("/in-store")
def get_in_store(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get company_id — for section tokens it's hardcoded to 1, so find first company
    company_id = current_user.company_id if current_user.company_id else 1

    company_id = current_user.company_id or 1
    items = db.query(Item).filter(
        Item.company_id == company_id,
    ).all()

    qr_item_ids = set(
        row.item_id for row in db.query(PartInstance.item_id).filter(
            PartInstance.company_id == current_user.company_id
        ).distinct().all()
    )

    # Get total ever received per item from StockLedger
    received_rows = db.query(
        StockLedger.item_id,
        func.sum(StockLedger.quantity).label("total")
    ).filter(
        StockLedger.transaction_type.in_(["purchase_in", "manual_in"]),
        StockLedger.company_id == current_user.company_id
    ).group_by(StockLedger.item_id).all()

    total_received_map = {row.item_id: float(row.total) for row in received_rows}

    return [
        {
            "item_id": i.id,
            "name": i.name,
            "part_code": i.code,
            "total_received": float(i.current_stock),
            "total_consumed": total_received_map.get(i.id, float(i.current_stock)) - float(i.current_stock),
            "in_stock": float(i.current_stock),
            "low_stock": float(i.current_stock) <= total_received_map.get(i.id, float(i.current_stock)) * 0.1,
            "track_qr": i.id in qr_item_ids,
        }
        for i in items
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
        quantity=abs(int(data.quantity)),
        unit_cost=0,
        transaction_date=date.today(),
        reason=data.reason
    )
    db.add(entry)

    # ← this was missing
    item.current_stock += int(data.quantity)
    if item.current_stock < 0:
        item.current_stock = 0

    db.commit()
    return {
        "message": f"Stock {'added' if data.quantity > 0 else 'deducted'} successfully",
        "item": item.name,
        "quantity": abs(int(data.quantity)),
        "type": transaction_type
    }


# ─── SCAN HISTORY ─────────────────────────────────────────────

@router.get("/in-store/{item_id}/scans")
def get_item_scan_history(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = (
        db.query(WIPScan, PartInstance, Worker)
        .join(PartInstance, WIPScan.part_instance_id == PartInstance.id)
        .outerjoin(Worker, WIPScan.worker_id == Worker.id)
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
            "worker": worker.name if worker else "—",
        }
        for scan, instance, worker in rows
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