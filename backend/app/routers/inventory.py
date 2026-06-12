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
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey
from app.models.purchase import PurchaseOrder, PurchaseInvoice  # add to imports if not present
from app.models.vendor import Vendor

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
    consumed_rows = db.query(
        StockLedger.item_id,
        func.sum(StockLedger.quantity).label("total")
    ).filter(
        StockLedger.transaction_type.in_(["issue_out", "manual_out", "wip_issue"]),  # ← add wip_issue
        StockLedger.company_id == current_user.company_id
    ).group_by(StockLedger.item_id).all()

    total_consumed_map = {row.item_id: float(row.total) for row in consumed_rows}

    return [
        {
            "item_id": i.id,
            "name": i.name,
            "part_code": i.code,
            "total_received": float(i.current_stock) + total_consumed_map.get(i.id, 0),
            "total_consumed": total_consumed_map.get(i.id, 0),
            "in_stock": float(i.current_stock),
            "low_stock": (
                i.id in total_received_map  # only flag if item has been received at least once
                and float(i.current_stock) <= total_received_map[i.id] * 0.1
            ),
            "track_qr": i.id in qr_item_ids,
        }
        for i in items
    ]


# ─── MANUAL ENTRY ─────────────────────────────────────────────

@router.post("/in-store/manual-entry")
def manual_stock_entry(
    data: ManualStockEntry,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "store_manager"))
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


@router.get("/in-store/{item_id}/manual-entries")
def get_manual_entries(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(StockLedger).filter(
        StockLedger.item_id == item_id,
        StockLedger.company_id == current_user.company_id,
        StockLedger.transaction_type.in_(["manual_in", "manual_out"]),
        StockLedger.reference_type == "manual"
    ).order_by(StockLedger.id.desc()).limit(20).all()

    return [
        {
            "transaction_date": r.transaction_date,
            "created_at": r.created_at if hasattr(r, "created_at") else None,
            "quantity": r.quantity,
            "transaction_type": r.transaction_type,
            "reason": r.reason
        }
        for r in rows
    ]


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



@router.get("/in-store/{item_id}/vendor-breakdown")
def get_vendor_breakdown(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rows = db.query(
        
        StockLedger.quantity,
        StockLedger.transaction_date,
        PurchaseOrder.po_number,
        Vendor.name.label("vendor_name")
    ).join(
        PurchaseInvoice, PurchaseInvoice.id == StockLedger.reference_id
    ).join(
        PurchaseOrder, PurchaseOrder.id == PurchaseInvoice.po_id
    ).join(
        Vendor, Vendor.id == PurchaseOrder.vendor_id
    ).filter(
        StockLedger.item_id == item_id,
        StockLedger.company_id == current_user.company_id,
        StockLedger.transaction_type == "purchase_in",
        StockLedger.reference_type == "purchase_invoice"
    ).order_by(StockLedger.transaction_date.desc()).all()

    # Group by vendor
    vendor_map = {}
    for row in rows:
        vname = row.vendor_name
        if vname not in vendor_map:
            vendor_map[vname] = {"vendor": vname, "total_qty": 0, "orders": []}
        vendor_map[vname]["total_qty"] += row.quantity
        vendor_map[vname]["orders"].append({
            "po_number": row.po_number,
            "quantity": row.quantity,
            "date": row.transaction_date,
        })

    return list(vendor_map.values())


@router.get("/debug/rap-roll")
def debug_rap_roll(db: Session = Depends(get_db)):
    from app.models.item import Item
    from app.models.stock import StockLedger
    from sqlalchemy import func

    items = db.query(Item).filter(
        func.lower(Item.name).contains("rap")
    ).all()

    ledger = db.query(StockLedger).filter(
        StockLedger.item_id.in_([i.id for i in items])
    ).all()

    return {
        "items": [{"id": i.id, "name": i.name, "stock": i.current_stock} for i in items],
        "ledger": [{"id": r.id, "item_id": r.item_id, "type": r.transaction_type, "ref_type": r.reference_type, "ref_id": r.reference_id, "qty": r.quantity} for r in ledger]
    }


@router.get("/admin/merge-duplicates")
def merge_duplicates(db: Session = Depends(get_db), current_user: User = Depends(require_role("admin"))):
    from app.models.purchase import PurchaseLineItem
    
    dupes = (
        db.query(Item.company_id, func.lower(Item.name).label("norm_name"), func.count(Item.id).label("cnt"))
        .filter(Item.company_id == current_user.company_id)
        .group_by(Item.company_id, func.lower(Item.name))
        .having(func.count(Item.id) > 1)
        .all()
    )

    results = []
    for d in dupes:
        items = db.query(Item).filter(
            Item.company_id == d.company_id,
            func.lower(Item.name) == d.norm_name
        ).order_by(Item.id).all()
        
        master = items[0]
        for dup in items[1:]:
            db.query(StockLedger).filter(StockLedger.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            db.query(PurchaseLineItem).filter(PurchaseLineItem.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            db.query(PartInstance).filter(PartInstance.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            master.current_stock += dup.current_stock
            if not master.code and dup.code:
                master.code = dup.code
            db.delete(dup)
            results.append(f"Merged '{dup.name}' (id={dup.id}) into '{master.name}' (id={master.id}), final stock={master.current_stock}")

    db.commit()
    return {"merged": results if results else ["No duplicates found"]}