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

router = APIRouter(prefix="/production", tags=["Production"])

# ─── SCHEMAS ─────────────────────────────────────────────────

class BOMLineIn(BaseModel):
    raw_material_id: int
    quantity_required: Decimal
    unit: str
    scrap_percentage: Optional[Decimal] = 0

class BOMCreate(BaseModel):
    finished_good_id: int
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
    start_date: Optional[date] = None

class ProductionOrderOut(BaseModel):
    id: int
    order_number: str
    bom_id: int
    planned_quantity: Decimal
    status: str
    production_cost: Optional[Decimal]
    class Config:
        from_attributes = True

# ─── CREATE BOM ───────────────────────────────────────────────

@router.post("/bom", response_model=BOMOut)
def create_bom(
    data: BOMCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    # Check finished good exists
    fg = db.query(Item).filter(Item.id == data.finished_good_id).first()
    if not fg:
        raise HTTPException(status_code=404, detail="Finished good item not found")

    bom = BOMHeader(
        company_id=current_user.company_id,
        finished_good_id=data.finished_good_id,
        version=data.version
    )
    db.add(bom)
    db.flush()

    for li in data.line_items:
        rm = db.query(Item).filter(Item.id == li.raw_material_id).first()
        if not rm:
            raise HTTPException(status_code=404, detail=f"Raw material {li.raw_material_id} not found")
        bom_line = BOMLineItem(
            bom_id=bom.id,
            raw_material_id=li.raw_material_id,
            quantity_required=li.quantity_required,
            unit=li.unit,
            scrap_percentage=li.scrap_percentage
        )
        db.add(bom_line)

    db.commit()
    db.refresh(bom)
    return bom

# ─── GET BOM WITH LINE ITEMS ──────────────────────────────────

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

# ─── CREATE PRODUCTION ORDER ──────────────────────────────────

@router.post("/orders", response_model=ProductionOrderOut)
def create_production_order(
    data: ProductionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    bom = db.query(BOMHeader).filter(
        BOMHeader.id == data.bom_id,
        BOMHeader.company_id == current_user.company_id
    ).first()
    if not bom:
        raise HTTPException(status_code=404, detail="BOM not found")

    # Check sufficient stock for all raw materials
    bom_lines = db.query(BOMLineItem).filter(BOMLineItem.bom_id == bom.id).all()
    for line in bom_lines:
        rm = db.query(Item).filter(Item.id == line.raw_material_id).first()
        qty_needed = line.quantity_required * data.planned_quantity
        # Add scrap
        qty_with_scrap = qty_needed * (1 + line.scrap_percentage / 100)
        if rm.current_stock < qty_with_scrap:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {rm.name}. Need {qty_with_scrap}, have {rm.current_stock}"
            )

    # Generate order number
    count = db.query(ProductionOrder).filter(
        ProductionOrder.company_id == current_user.company_id
    ).count()
    order_number = f"PRD-{current_user.company_id}-{str(count + 1).zfill(4)}"

    order = ProductionOrder(
        company_id=current_user.company_id,
        bom_id=data.bom_id,
        order_number=order_number,
        planned_quantity=data.planned_quantity,
        start_date=data.start_date or date.today(),
        status="planned",
        created_by=current_user.id
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

# ─── COMPLETE PRODUCTION ORDER ────────────────────────────────

@router.patch("/orders/{order_id}/complete")
def complete_production_order(
    order_id: int,
    actual_quantity: int,
    scrap_quantity: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
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

    # Consume raw materials
    for line in bom_lines:
        rm = db.query(Item).filter(Item.id == line.raw_material_id).first()
        qty_consumed = line.quantity_required * actual_quantity
        qty_with_scrap = qty_consumed * (1 + line.scrap_percentage / 100)

        # Deduct from stock
        rm.current_stock -= qty_with_scrap

        # Stock ledger entry
        stock_out = StockLedger(
            company_id=current_user.company_id,
            item_id=rm.id,
            transaction_type="production_consumption",
            reference_id=order.id,
            reference_type="production_order",
            quantity=-qty_with_scrap,
            unit_cost=None,
            transaction_date=date.today()
        )
        db.add(stock_out)

        # Add to cost (approximate)
        total_cost += qty_with_scrap * Decimal("50")  # placeholder unit cost

    # Add finished goods to stock
    fg.current_stock += actual_quantity

    # Stock ledger — finished goods in
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

    # Generate QR for each finished good unit
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

    # Update order
    order.actual_quantity = actual_quantity
    order.scrap_quantity = scrap_quantity
    order.end_date = date.today()
    order.status = "completed"
    order.production_cost = total_cost

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

# ─── GET QR CODES FOR PRODUCTION ORDER ───────────────────────

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

# ─── GET ALL ORDERS ───────────────────────────────────────────

@router.get("/orders", response_model=List[ProductionOrderOut])
def get_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ProductionOrder).filter(
        ProductionOrder.company_id == current_user.company_id
    ).all()