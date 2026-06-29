from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
from app.database import get_db
from app.models.production import BOMHeader, BOMLineItem, ProductionOrder
from app.models.stock import StockLedger, PartInstance
from app.models.item import Item
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from app.services.qr import generate_qr_base64, generate_part_qr_data
from app.models.wip_scan import WIPScan
from app.models.worker import Worker
from app.models.stock import PartInstance
from datetime import datetime
from app.utils.otp import verify_delete_otp
from app.models.customer import Customer
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from fastapi import Query

router = APIRouter(prefix="/production", tags=["Production"])

# ─── SCHEMAS ─────────────────────────────────────────────────

class BOMLineIn(BaseModel):
    raw_material_name: str 
    quantity_required: Decimal
    unit: str
    scrap_percentage: Optional[Decimal] = 0

class BOMCreate(BaseModel):
    finished_good_name: str
    version: Optional[str] = "1.0"
    line_items: List[BOMLineIn]

class BOMLineOut(BaseModel):
    id: int
    raw_material_id: int
    quantity_required: Decimal
    unit: str
    scrap_percentage: Decimal
    class Config:
        from_attributes = True

class BOMOut(BaseModel):
    id: int
    finished_good_id: int
    version: str
    is_active: bool
    class Config:
        from_attributes = True

class ProductionOrderCreate(BaseModel):
    bom_id: int
    planned_quantity: int
    customer_id: Optional[int] = None
    start_date: Optional[date] = None
    cost_per_unit: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = Decimal("0")

class ProductionOrderOut(BaseModel):
    id: int
    order_number: str
    bom_id: int
    planned_quantity: Decimal
    status: str
    production_cost: Optional[Decimal]
    class Config:
        from_attributes = True

class ProductionPayIn(BaseModel):
    amount: float
    note: str = ""

# ─── BOM ─────────────────────────────────────────────────────

@router.post("/bom", response_model=BOMOut)
def create_bom(
    data: BOMCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "production"))
):
    # Find or create finished good item
    fg = db.query(Item).filter(
        func.lower(Item.name) == data.finished_good_name.lower(),
        Item.company_id == current_user.company_id
    ).first()
    if not fg:
        fg = Item(
            company_id=current_user.company_id,
            name=data.finished_good_name,
            item_type='finished_good',
            hsn_code='',       # ← add these
            unit='pcs',        # ← add these
            tax_rate=0,
            current_stock=0
        )
        db.add(fg)
        db.flush()

    bom = BOMHeader(
        company_id=current_user.company_id,
        finished_good_id=fg.id,
        version=data.version
    )
    db.add(bom)
    db.flush()

    for li in data.line_items:
        rm = db.query(Item).filter(
            func.lower(Item.name) == li.raw_material_name.lower(),
            Item.company_id == current_user.company_id
        ).first()
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw material '{li.raw_material_name}' not found in inventory")
        bom_line = BOMLineItem(
            bom_id=bom.id,
            raw_material_id=rm.id,
            quantity_required=li.quantity_required,
            unit=li.unit,
            scrap_percentage=li.scrap_percentage
        )
        db.add(bom_line)

    db.commit()
    db.refresh(bom)
    return bom

@router.get("/bom/{bom_id}")
def get_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bom = db.query(BOMHeader).filter(
        BOMHeader.id == bom_id,
        BOMHeader.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    lines = db.query(BOMLineItem).filter(BOMLineItem.bom_id == bom_id).all()
    fg = db.query(Item).filter(Item.id == bom.finished_good_id).first()

    return {
        "bom_id": bom.id,
        "finished_good": fg.name,
        "version": bom.version,
        "line_items": [{
            "raw_material_id": l.raw_material_id,
            "raw_material": db.query(Item).filter(Item.id == l.raw_material_id).first().name,
            "quantity_required": l.quantity_required,
            "unit": l.unit,
            "scrap_percentage": l.scrap_percentage
        } for l in lines]
    }

@router.get("/bom")
def get_all_boms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    boms = db.query(BOMHeader).filter(
        BOMHeader.company_id == current_user.company_id,
        BOMHeader.is_active == True
    ).all()
    return [{
        "id": b.id,
        "finished_good": db.query(Item).filter(Item.id == b.finished_good_id).first().name,
        "version": b.version
    } for b in boms]

# ─── PRODUCTION ORDERS ────────────────────────────────────────

@router.post("/orders", response_model=ProductionOrderOut)
def create_production_order(
    data: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "production"))
):
    bom = db.query(BOMHeader).filter(
        BOMHeader.id == data.bom_id,
        BOMHeader.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    

    count = db.query(ProductionOrder).filter(
        ProductionOrder.company_id == current_user.company_id
    ).count()

    if data.customer_id:
        customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
        words = customer.name.split()
        prefix = ''.join(w[0] for w in words)[:3].upper() if customer else "PRD"
    else:
        prefix = "PRD"

    order_number = f"{prefix}-{str(count + 1).zfill(4)}"


    order = ProductionOrder(
        company_id=current_user.company_id,
        bom_id=data.bom_id,
        customer_id=data.customer_id,
        order_number=order_number,
        planned_quantity=data.planned_quantity,
        start_date=data.start_date or date.today(),
        status="planned",
        production_cost=data.cost_per_unit * data.planned_quantity if data.cost_per_unit else None,
        tax_rate=data.tax_rate or 0,
        tax_amount=(data.cost_per_unit * data.planned_quantity * data.tax_rate / 100) if data.cost_per_unit and data.tax_rate else 0,
        created_by=current_user.id
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.patch("/orders/{order_id}/complete")
def complete_production_order(
    order_id: int,
    actual_quantity: int,
    scrap_quantity: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant", "production"))
):
    order = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Production order not found")
    if order.status == "completed":
        raise HTTPException(status_code=400, detail="Order already completed")

    bom = db.query(BOMHeader).filter(BOMHeader.id == order.bom_id).first()
    bom_lines = db.query(BOMLineItem).filter(BOMLineItem.bom_id == bom.id).all()
    fg = db.query(Item).filter(Item.id == bom.finished_good_id).first()

    total_cost = Decimal("0")

    for line in bom_lines:
        rm = db.query(Item).filter(Item.id == line.raw_material_id).first()
        qty_consumed = line.quantity_required * actual_quantity
        qty_with_scrap = qty_consumed * (1 + line.scrap_percentage / 100)
        

        
        unit_cost = Decimal(str(rm.purchase_price or 50))
        total_cost += qty_with_scrap * unit_cost

    fg.current_stock += actual_quantity

    stock_in = StockLedger(
        company_id=current_user.company_id,
        item_id=fg.id,
        transaction_type="production_output",
        reference_id=order.id,
        reference_type="production_order",
        quantity=actual_quantity,
        unit_cost=total_cost / actual_quantity if actual_quantity else 0,
        transaction_date=date.today()
    )
    db.add(stock_in)

    qr_codes = []
    for unit_num in range(1, actual_quantity + 1):
        qr_data = generate_part_qr_data(
            "finished_good",
            fg.code or fg.name,
            order.order_number,
            unit_num
        )
        qr_image = generate_qr_base64(qr_data)
        part = PartInstance(
            company_id=current_user.company_id,
            purchase_order_id=None,
            item_id=fg.id,
            serial_number=qr_data,
            qr_code_data=qr_data,
            qr_code_image=qr_image,
            current_status="in_stock"
        )
        db.add(part)
        qr_codes.append(qr_data)

    order.actual_quantity = actual_quantity
    order.scrap_quantity = scrap_quantity
    order.end_date = date.today()
    order.status = "completed"
    order.production_cost = total_cost
    order.tax_amount = total_cost * (order.tax_rate or 0) / 100
    db.commit()

    return {
        "message": "Production order completed",
        "order_number": order.order_number,
        "actual_quantity": actual_quantity,
        "scrap_quantity": scrap_quantity,
        "production_cost": str(total_cost),
        "qr_codes_generated": len(qr_codes),
        "finished_good": fg.name,
        "note": f"GET /production/orders/{order_id}/qr-codes to fetch all QR images"
    }

@router.get("/orders/{order_id}/qr-codes")
def get_production_qr_codes(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    bom = db.query(BOMHeader).filter(BOMHeader.id == order.bom_id).first()
    fg = db.query(Item).filter(Item.id == bom.finished_good_id).first()

    parts = db.query(PartInstance).filter(
        PartInstance.item_id == fg.id,
        PartInstance.company_id == current_user.company_id
    ).all()

    return [{
        "serial_number": p.serial_number,
        "qr_code_image": p.qr_code_image,
        "status": p.current_status
    } for p in parts]



@router.get("/orders")
def get_orders(
    skip: int = 0,
    limit: int = Query(default=50, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(ProductionOrder).filter(
        ProductionOrder.company_id == current_user.company_id
    ).order_by(ProductionOrder.created_at.desc()).offset(skip).limit(limit).all()

    bom_ids = {o.bom_id for o in orders}
    customer_ids = {o.customer_id for o in orders if o.customer_id}

    boms = {b.id: b for b in db.query(BOMHeader).filter(BOMHeader.id.in_(bom_ids)).all()}
    fg_ids = {b.finished_good_id for b in boms.values()}
    items = {i.id: i for i in db.query(Item).filter(Item.id.in_(fg_ids)).all()}
    customers = {c.id: c for c in db.query(Customer).filter(Customer.id.in_(customer_ids)).all()}

    result = []
    for o in orders:
        customer = customers.get(o.customer_id)
        bom = boms.get(o.bom_id)
        fg = items.get(bom.finished_good_id) if bom else None

        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "bom_id": o.bom_id,
            "finished_good_name": fg.name if fg else "—",
            "customer_id": o.customer_id,
            "customer_name": customer.name if customer else "No Customer",
            "planned_quantity": o.planned_quantity,
            "actual_quantity": o.actual_quantity,
            "scrap_quantity": o.scrap_quantity,
            "production_cost": o.production_cost,
            "tax_rate": float(o.tax_rate or 0),
            "tax_amount": float(o.tax_amount or 0),
            "status": o.status,
            "start_date": o.start_date,
            "end_date": o.end_date,
            "created_at": o.created_at,
            "amount_paid": float(o.amount_paid or 0),
            "payment_note": o.payment_note or "",
            "payment_status": "paid" if float(o.amount_paid or 0) >= float(o.production_cost or 0) and float(o.production_cost or 0) > 0 else "partial" if float(o.amount_paid or 0) > 0 else "unpaid",
        })
    return result

# ─── WIP SCANS ───────────────────────────────────────────────

@router.get("/wip")
def get_wip_scans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ← add this
):
    results = (
        db.query(WIPScan, Worker.name, Worker.department, PartInstance.qr_code_data, Item.name)
        .join(Worker, WIPScan.worker_id == Worker.id)
        .outerjoin(PartInstance, WIPScan.part_instance_id == PartInstance.id)
        .outerjoin(Item, WIPScan.item_id == Item.id)
        .filter(WIPScan.company_id == current_user.company_id)  # ← add this
        .order_by(WIPScan.scanned_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": scan.id,
            "worker_id": scan.worker_id,
            "worker_name": name,
            "worker_department": department,
            "part_code": qr_code_data or item_name,
            "part_instance_id": scan.part_instance_id,
            "scan_type": scan.scan_type,
            "workstation": scan.workstation,
            "duration_minutes": scan.duration_minutes,
            "scanned_at": scan.scanned_at,
            "quantity": scan.quantity,
        }
        for scan, name, department, qr_code_data, item_name in results
    ]


class WIPScanIn(BaseModel):
    worker_qr: str
    part_qr: str
    quantity: Optional[Decimal] = Decimal("1")
    operation: Optional[str] = None
    product_code: Optional[str] = None
    notes: Optional[str] = None
    workstation: Optional[str] = None

@router.post("/wip/scan")
def submit_wip_scan(data: WIPScanIn, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.qr_code_data == data.worker_qr).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker QR not recognised")

    qr = data.part_qr.strip()

    if qr.startswith("UNIT-"):
        part = db.query(PartInstance).filter(PartInstance.qr_code_data == qr).first()
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        if part.current_status == "issued":
            raise HTTPException(status_code=400, detail="This part has already been scanned/issued")

        part.current_status = "issued"
        scan = WIPScan(
            company_id=worker.company_id,
            worker_id=worker.id,
            part_instance_id=part.id,
            item_id=part.item_id,
            quantity=data.quantity or 1,
            operation=data.operation,
            product_code=data.product_code,
            notes=data.notes,
            workstation=data.workstation,
            scanned_at=datetime.utcnow()
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return {"message": "Scan recorded", "scan_id": scan.id, "worker_name": worker.name}

    elif qr.startswith("BULK-"):
        try:
            item_id = int(qr.split("-")[1])
        except (IndexError, ValueError):
            raise HTTPException(status_code=400, detail="Invalid BULK QR format")

        item = db.query(Item).filter(
            Item.id == item_id,
            Item.company_id == worker.company_id
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        qty = data.quantity or 1
        if qty < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        if item.current_stock < qty:
            raise HTTPException(status_code=400, detail=f"Only {item.current_stock} {item.unit} available")

        item.current_stock -= qty

        stock_out = StockLedger(
            company_id=worker.company_id,
            item_id=item.id,
            transaction_type="wip_issue",
            reference_id=worker.id,
            reference_type="wip_scan",
            quantity=qty,
            unit_cost=item.purchase_price,
            transaction_date=date.today()
        )
        db.add(stock_out)

        scan = WIPScan(
            company_id=worker.company_id,
            worker_id=worker.id,
            part_instance_id=None,
            item_id=item.id,
            quantity=qty,
            operation=data.operation,
            product_code=data.product_code,
            notes=data.notes,
            workstation=data.workstation,
            scanned_at=datetime.utcnow()
        )
        db.add(scan)
        db.commit()
        db.refresh(scan)
        return {"message": "Scan recorded", "scan_id": scan.id, "worker_name": worker.name, "remaining_stock": item.current_stock}

    elif qr.startswith("PIPE-"):
    try:
        parts_qr = qr.split("-")
        item_id = int(parts_qr[1])
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid PIPE QR format")

    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == worker.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Pipe not found for this QR")

    # Find the specific pipe instance being scanned
    pipe_instance = db.query(PartInstance).filter(
        PartInstance.qr_code_data == qr,
        PartInstance.company_id == worker.company_id
    ).first()

    qty = data.quantity or Decimal("1")
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than 0")

    # Check remaining on THIS specific pipe, not total stock
    if pipe_instance:
        remaining = pipe_instance.remaining_quantity or Decimal("1")
        if qty > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Only {remaining} remaining on this pipe — cannot use {qty}"
            )
        pipe_instance.remaining_quantity = remaining - qty
    else:
        # No instance tracked — fall back to item stock check
        if item.current_stock < qty:
            raise HTTPException(status_code=400, detail=f"Only {item.current_stock} {item.unit} in stock")

    item.current_stock -= qty

    stock_out = StockLedger(
        company_id=worker.company_id,
        item_id=item.id,
        transaction_type="wip_issue",
        reference_id=worker.id,
        reference_type="wip_scan",
        quantity=qty,
        unit_cost=item.purchase_price,
        transaction_date=date.today()
    )
    db.add(stock_out)

    scan = WIPScan(
        company_id=worker.company_id,
        worker_id=worker.id,
        part_instance_id=pipe_instance.id if pipe_instance else None,
        item_id=item.id,
        quantity=qty,
        operation=data.operation,
        product_code=data.product_code,
        notes=data.notes,
        workstation=data.workstation,
        scanned_at=datetime.utcnow()
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return {
        "message": "Pipe usage recorded",
        "scan_id": scan.id,
        "worker_name": worker.name,
        "remaining_stock": float(pipe_instance.remaining_quantity) if pipe_instance else float(item.current_stock)
    }

    else:
        raise HTTPException(status_code=400, detail="QR must start with UNIT-, BULK-, or PIPE-")


@router.get("/wip/pipe-status")
def pipe_status(qr: str, db: Session = Depends(get_db)):
    try:
        item_id = int(qr.split("-")[1])
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid PIPE QR format")

    # Check specific pipe instance remaining
    pipe_instance = db.query(PartInstance).filter(
        PartInstance.qr_code_data == qr
    ).first()

    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Pipe not found")

    remaining = float(pipe_instance.remaining_quantity) if pipe_instance else float(item.current_stock)

    return {
        "remaining_quantity": remaining,
        "status": "available" if remaining > 0 else "depleted"
    }

#----Verify worker --------

class WorkerQRIn(BaseModel):
    qr_code: str

@router.post("/wip/verify-worker")
def verify_worker(data: WorkerQRIn, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.qr_code_data == data.qr_code).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"id": worker.id, "name": worker.name, "department": worker.department}


# ─── DELETE PRODUCTION ORDER ─────────────────────────────────

@router.delete("/orders/{order_id}")
def delete_production_order(
    order_id: int,
    otp: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    # 1. Verify OTP first
    if not verify_delete_otp(otp):
        raise HTTPException(status_code=403, detail="Invalid OTP")

    order = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Production order not found")

    # 2. Find part instances linked to this order
    bom = db.query(BOMHeader).filter(BOMHeader.id == order.bom_id).first()
    fg = db.query(Item).filter(Item.id == bom.finished_good_id).first()
    parts = db.query(PartInstance).filter(
        PartInstance.item_id == fg.id,
        PartInstance.company_id == current_user.company_id,
        PartInstance.serial_number.like(f"%{order.order_number}%")
    ).all()
    part_ids = [p.id for p in parts]

    # 3. Delete wip_scans and part instances
    if part_ids:
        db.query(WIPScan).filter(WIPScan.part_instance_id.in_(part_ids)).delete(synchronize_session=False)
        db.query(PartInstance).filter(PartInstance.id.in_(part_ids)).delete(synchronize_session=False)

    # 4. Delete stock ledger entries
    db.query(StockLedger).filter(
        StockLedger.reference_id == order_id,
        StockLedger.reference_type == "production_order"
    ).delete()

    # 5. Delete the order
    db.delete(order)
    db.commit()
    return {"message": "Production order deleted successfully"}
 

 




# ─── DELETE WIP SCAN ─────────────────────────────────────────

@router.delete("/wip/{scan_id}")
def delete_wip_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    scan = db.query(WIPScan).filter(
        WIPScan.id == scan_id,
        WIPScan.company_id == current_user.company_id
    ).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    db.delete(scan)
    db.commit()
    return {"message": "Scan deleted successfully"}



@router.post("/orders/{order_id}/pay")
def mark_order_paid(
    order_id: int,
    data: ProductionPayIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    order = db.query(ProductionOrder).filter(
        ProductionOrder.id == order_id,
        ProductionOrder.company_id == current_user.company_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.amount_paid = float(order.amount_paid or 0) + data.amount
    existing = order.payment_note or ""
    new_note = data.note.strip()
    if new_note:
        order.payment_note = f"{existing} | {new_note}".strip(" |") if existing else new_note
    db.commit()
    return {
        "message": "Payment recorded",
        "amount_paid": float(order.amount_paid),
        "balance": float(order.production_cost or 0) - float(order.amount_paid),
        "note": order.payment_note
    }