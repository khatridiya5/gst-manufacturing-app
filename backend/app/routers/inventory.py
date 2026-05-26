from app.database import get_db
from app.models.purchase import PurchaseOrder, PurchaseOrderItem
from app.models.production import WIPScan
from app.models.master import Item

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("/in-store")
def get_in_store(db: Session = Depends(get_db)):
    # Total received per item (from completed POs)
    received = (
        db.query(
            PurchaseOrderItem.item_id,
            func.sum(PurchaseOrderItem.quantity).label("total_received")
        )
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.po_id)
        .filter(PurchaseOrder.status == "received")
        .group_by(PurchaseOrderItem.item_id)
        .subquery()
    )

    # Total consumed per item (start scans only)
    consumed = (
        db.query(
            WIPScan.item_id,
            func.count(WIPScan.id).label("total_consumed")
        )
        .filter(WIPScan.scan_type == "start")
        .group_by(WIPScan.item_id)
        .subquery()
    )

    # Join with items table
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
            "total_received": r.total_received,
            "total_consumed": r.total_consumed,
            "in_stock": r.total_received - r.total_consumed,
            "low_stock": (r.total_received - r.total_consumed) <= (r.total_received * 0.2),
        }
        for r in results
    ]


@router.get("/in-store/{item_id}/scans")
def get_item_scan_history(item_id: int, db: Session = Depends(get_db)):
    scans = (
        db.query(WIPScan)
        .filter(WIPScan.item_id == item_id, WIPScan.scan_type == "start")
        .order_by(WIPScan.scanned_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "worker": s.worker.name,
            "part_instance": s.part_instance_code,
            "scanned_at": s.scanned_at,
        }
        for s in scans
    ]