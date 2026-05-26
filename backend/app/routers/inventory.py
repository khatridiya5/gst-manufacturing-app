from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.purchase import PurchaseOrder, POLineItem
from app.models.wip_scan import WIPScan
from app.models.stock import PartInstance, StockLedger
from app.models.item import Item

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("/in-store")
def get_in_store(db: Session = Depends(get_db)):
    # Total received per item (sum from stock_ledger where transaction_type = 'purchase')
    received = (
        db.query(
            StockLedger.item_id,
            func.sum(StockLedger.quantity).label("total_received")
        )
        .filter(StockLedger.transaction_type == "purchase_in")
        .group_by(StockLedger.item_id)
        .subquery()
    )

    # Total consumed = count of 'start' scans per item (via PartInstance)
    consumed = (
        db.query(
            PartInstance.item_id,
            func.count(WIPScan.id).label("total_consumed")
        )
        .join(WIPScan, WIPScan.part_instance_id == PartInstance.id)
        .filter(WIPScan.scan_type == "start")
        .group_by(PartInstance.item_id)
        .subquery()
    )

    results = (
        db.query(
            Item.id,
            Item.name,
            Item.part_code,
            received.c.total_received,
            func.coalesce(consumed.c.total_consumed, 0).label("total_consumed"),
        )
        .join(received, received.c.item_id == Item.id)
        .outerjoin(consumed, consumed.c.item_id == Item.id)
        .all()
    )

    return [
        {
            "item_id": r.id,
            "name": r.name,
            "part_code": r.part_code,
            "total_received": float(r.total_received),
            "total_consumed": int(r.total_consumed),
            "in_stock": float(r.total_received) - int(r.total_consumed),
            "low_stock": (float(r.total_received) - int(r.total_consumed)) <= (float(r.total_received) * 0.2),
        }
        for r in results
    ]


@router.get("/in-store/{item_id}/scans")
def get_item_scan_history(item_id: int, db: Session = Depends(get_db)):
    # Get start scans for this item via PartInstance
    rows = (
        db.query(WIPScan, PartInstance)
        .join(PartInstance, WIPScan.part_instance_id == PartInstance.id)
        .filter(PartInstance.item_id == item_id, WIPScan.scan_type == "start")
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