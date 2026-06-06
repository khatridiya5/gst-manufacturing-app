from app.database import SessionLocal
from app.models.item import Item
from app.models.stock import StockLedger, PartInstance
from app.models.purchase import PurchaseLineItem
from sqlalchemy import func

db = SessionLocal()

try:
    dupes = (
        db.query(Item.company_id, func.lower(Item.name).label("norm_name"), func.count(Item.id).label("cnt"))
        .group_by(Item.company_id, func.lower(Item.name))
        .having(func.count(Item.id) > 1)
        .all()
    )

    if not dupes:
        print("✅ No duplicate items found.")
    else:
        print(f"Found {len(dupes)} duplicate group(s):\n")

    for d in dupes:
        items = db.query(Item).filter(Item.company_id == d.company_id, func.lower(Item.name) == d.norm_name).order_by(Item.id).all()
        master = items[0]
        for dup in items[1:]:
            print(f"Merging '{dup.name}' (id={dup.id}, stock={dup.current_stock}) → master id={master.id}")
            db.query(StockLedger).filter(StockLedger.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            db.query(PurchaseLineItem).filter(PurchaseLineItem.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            db.query(PartInstance).filter(PartInstance.item_id == dup.id).update({"item_id": master.id}, synchronize_session=False)
            master.current_stock += dup.current_stock
            if not master.code and dup.code:
                master.code = dup.code
            db.delete(dup)
        print(f"  Master '{master.name}' final stock: {master.current_stock}\n")

    db.commit()
    print("✅ Done.")
except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
    raise
finally:
    db.close()
