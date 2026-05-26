from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item
from app.models.wip_scan import WIPScan
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/in-store")
def get_in_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)   # ← ADD THIS
):
    received = (
        db.query(
            StockLedger.item_id,
            func.sum(StockLedger.quantity).label("total_received")
        )
        .filter(
            StockLedger.transaction_type == "purchase_in",
            StockLedger.company_id == current_user.company_id  # ← ADD THIS
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
            PartInstance.company_id == current_user.company_id  # ← ADD THIS
        )
        .group_by(PartInstance.item_id)
        .subquery()
    )

    results = (
        db.query(
            Item.id,
            Item.name,
            Item.code,
            received.c.total_received,
            func.coalesce(consumed.c.total_consumed, 0).label("total_consumed"),
        )
        .join(received, received.c.item_id == Item.id)  # still INNER JOIN — only items with stock
        .outerjoin(consumed, consumed.c.item_id == Item.id)
        .filter(Item.company_id == current_user.company_id)  # ← ADD THIS
        .all()
    )

    return [
        {
            "item_id": r.id,
            "name": r.name,
            "part_code": r.code,
            "total_received": float(r.total_received),
            "total_consumed": int(r.total_consumed),
            "in_stock": float(r.total_received) - int(r.total_consumed),
            "low_stock": (float(r.total_received) - int(r.total_consumed))
                         <= (float(r.total_received) * 0.1),
        }
        for r in results
    ]


@router.get("/in-store/{item_id}/scans")
def get_item_scan_history(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)   # ← ADD THIS
):
    rows = (
        db.query(WIPScan, PartInstance)
        .join(PartInstance, WIPScan.part_instance_id == PartInstance.id)
        .filter(
            PartInstance.item_id == item_id,
            PartInstance.company_id == current_user.company_id,  # ← ADD THIS
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
        }
        for scan, instance in rows
    ]


# ── debug endpoints (keep for now, remove before prod) ────────

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