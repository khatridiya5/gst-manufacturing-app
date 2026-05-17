from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal
from app.database import get_db
from app.models.item import Item
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.utils.auth import get_current_user, require_role
from app.models.user import User

router = APIRouter(prefix="/master", tags=["Master Data"])

# ─── ITEM SCHEMAS ────────────────────────────────────────────
class ItemCreate(BaseModel):
    name: str
    code: Optional[str] = None
    item_type: str  # raw_material, finished_good, scrap
    hsn_code: str
    unit: str
    tax_rate: Decimal
    opening_stock: Optional[Decimal] = 0

class ItemOut(BaseModel):
    id: int
    name: str
    code: Optional[str]
    item_type: str
    hsn_code: str
    unit: str
    tax_rate: Decimal
    current_stock: Decimal
    class Config:
        from_attributes = True


# ─── VENDOR SCHEMAS ──────────────────────────────────────────
class VendorCreate(BaseModel):
    name: str
    gstin: Optional[str] = None
    state_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class VendorOut(BaseModel):
    id: int
    name: str
    gstin: Optional[str]
    state_code: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    is_active: bool
    class Config:
        from_attributes = True

# ─── ITEM ENDPOINTS ──────────────────────────────────────────
@router.post("/items", response_model=ItemOut)
def create_item(
    item: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    new_item = Item(
        **item.dict(),
        company_id=current_user.company_id,
        current_stock=item.opening_stock
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@router.get("/items", response_model=List[ItemOut])
def get_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Item).filter(Item.company_id == current_user.company_id).all()

@router.get("/items/{item_id}", response_model=ItemOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/items/{item_id}", response_model=ItemOut)
def update_item(
    item_id: int,
    item_data: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in item_data.dict().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/items/{item_id}")
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    from app.models.purchase import POLineItem, PurchaseLineItem
    from app.models.production import BOMLineItem, BOMHeader, ProductionOrder
    from app.models.stock import StockLedger, PartInstance
    from app.models.wip_scan import WIPScan
    from app.models.sales import SalesLineItem

    item = db.query(Item).filter(
        Item.id == item_id,
        Item.company_id == current_user.company_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # 1. wip_scans → part_instances
    parts = db.query(PartInstance).filter(PartInstance.item_id == item_id).all()
    part_ids = [p.id for p in parts]
    if part_ids:
        db.query(WIPScan).filter(WIPScan.part_instance_id.in_(part_ids)).delete(synchronize_session=False)
        db.query(PartInstance).filter(PartInstance.id.in_(part_ids)).delete(synchronize_session=False)

    # 2. BOM headers (finished good) → line items + production orders
    boms = db.query(BOMHeader).filter(BOMHeader.finished_good_id == item_id).all()
    bom_ids = [b.id for b in boms]
    if bom_ids:
        db.query(BOMLineItem).filter(BOMLineItem.bom_id.in_(bom_ids)).delete(synchronize_session=False)
        orders = db.query(ProductionOrder).filter(ProductionOrder.bom_id.in_(bom_ids)).all()
        order_ids = [o.id for o in orders]
        if order_ids:
            db.query(StockLedger).filter(
                StockLedger.reference_id.in_(order_ids),
                StockLedger.reference_type == "production_order"
            ).delete(synchronize_session=False)
        db.query(ProductionOrder).filter(ProductionOrder.bom_id.in_(bom_ids)).delete(synchronize_session=False)
        db.query(BOMHeader).filter(BOMHeader.id.in_(bom_ids)).delete(synchronize_session=False)

    # 3. BOM line items (raw material)
    db.query(BOMLineItem).filter(BOMLineItem.raw_material_id == item_id).delete()

    # 4. Purchase line items
    db.query(POLineItem).filter(POLineItem.item_id == item_id).delete()
    db.query(PurchaseLineItem).filter(PurchaseLineItem.item_id == item_id).delete()

    # 5. Sales line items
    db.query(SalesLineItem).filter(SalesLineItem.item_id == item_id).delete()

    # 6. Stock ledger
    db.query(StockLedger).filter(StockLedger.item_id == item_id).delete()

    # 7. Delete item
    db.delete(item)
    db.commit()
    return {"message": "Item deleted successfully"}

# ─── VENDOR ENDPOINTS ────────────────────────────────────────
@router.post("/vendors", response_model=VendorOut)
def create_vendor(
    vendor: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    new_vendor = Vendor(**vendor.dict(), company_id=current_user.company_id)
    db.add(new_vendor)
    db.commit()
    db.refresh(new_vendor)
    return new_vendor

@router.get("/vendors", response_model=List[VendorOut])
def get_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Vendor).filter(
        Vendor.company_id == current_user.company_id,
        Vendor.is_active == True
    ).all()

# ─── CUSTOMER SCHEMAS ────────────────────────────────────────
class CustomerCreate(BaseModel):
    name: str
    gstin: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class CustomerOut(BaseModel):
    id: int
    name: str
    gstin: Optional[str]
    state: Optional[str]
    state_code: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    is_active: bool
    class Config:
        from_attributes = True

# ─── CUSTOMER ENDPOINTS ──────────────────────────────────────
@router.post("/customers", response_model=CustomerOut)
def create_customer(
    customer: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "accountant"))
):
    new_customer = Customer(**customer.dict(), company_id=current_user.company_id)
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer

@router.get("/customers", response_model=List[CustomerOut])
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Customer).filter(
        Customer.company_id == current_user.company_id,
        Customer.is_active == True
    ).all()


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    from app.models.sales import SalesInvoice, SalesLineItem

    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.company_id == current_user.company_id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Get all invoice ids for this customer
    invoice_ids = [inv.id for inv in db.query(SalesInvoice).filter(SalesInvoice.customer_id == customer_id).all()]
    
    # Delete line items first
    if invoice_ids:
        db.query(SalesLineItem).filter(SalesLineItem.sales_invoice_id.in_(invoice_ids)).delete(synchronize_session=False)
        db.query(SalesInvoice).filter(SalesInvoice.id.in_(invoice_ids)).delete(synchronize_session=False)

    db.delete(customer)
    db.commit()
    return {"message": "Customer deleted successfully"}

    

@router.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.is_active = False  # soft delete
    db.commit()
    return {"message": "Vendor deactivated"}