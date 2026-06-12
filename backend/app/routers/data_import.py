from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
import openpyxl
from datetime import date
from app.database import get_db
from app.models.item import Item
from app.models.vendor import Vendor
from app.models.customer import Customer
from app.models.stock import StockLedger
from app.utils.auth import get_current_user, require_role
from app.models.user import User

router = APIRouter(prefix="/import", tags=["Data Import"])


def safe_str(val):
    return str(val).strip() if val is not None else None


@router.post("/excel")
async def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload a .xlsx file")

    wb = openpyxl.load_workbook(file.file, data_only=True)
    company_id = current_user.company_id

    summary = {"items": 0, "vendors": 0, "customers": 0, "skipped": 0, "errors": []}

    # ── ITEMS ──
    if "Items" in wb.sheetnames:
        ws = wb["Items"]
        headers = [c.value for c in ws[1]]
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                existing = db.query(Item).filter(
                    func.lower(Item.name) == name.lower(),
                    Item.company_id == company_id
                ).first()

                opening_qty = int(float(data.get("opening_stock") or 0))
                purchase_price = float(data.get("purchase_price") or 0)

                if existing:
                    item = existing
                else:
                    item = Item(
                        company_id=company_id,
                        name=name,
                        code=safe_str(data.get("code")),
                        item_type=safe_str(data.get("item_type")) or "raw_material",
                        hsn_code=safe_str(data.get("hsn_code")) or "0000",
                        unit=safe_str(data.get("unit")) or "pcs",
                        tax_rate=data.get("tax_rate") or 0,
                        opening_stock=opening_qty,
                        current_stock=0,
                        purchase_price=purchase_price,
                        tracking_type=safe_str(data.get("tracking_type")) or "unit",
                    )
                    db.add(item)
                    db.flush()

                if opening_qty:
                    item.current_stock = (item.current_stock or 0) + opening_qty
                    db.add(StockLedger(
                        company_id=company_id,
                        item_id=item.id,
                        transaction_type="opening_balance",
                        reference_type="import",
                        quantity=opening_qty,
                        unit_cost=purchase_price,
                        transaction_date=date.today(),
                        reason="Opening stock from migration import"
                    ))

                summary["items"] += 1
            except Exception as e:
                summary["errors"].append(f"Items row {row_num}: {e}")

    # ── VENDORS ──
    if "Vendors" in wb.sheetnames:
        ws = wb["Vendors"]
        headers = [c.value for c in ws[1]]
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                existing = db.query(Vendor).filter(
                    func.lower(Vendor.name) == name.lower(),
                    Vendor.company_id == company_id
                ).first()
                if not existing:
                    db.add(Vendor(
                        company_id=company_id,
                        name=name,
                        gstin=safe_str(data.get("gstin")),
                        pan=safe_str(data.get("pan")),
                        address=safe_str(data.get("address")),
                        state=safe_str(data.get("state")),
                        state_code=safe_str(data.get("state_code")),
                        phone=safe_str(data.get("phone")),
                        email=safe_str(data.get("email")),
                        bank_name=safe_str(data.get("bank_name")),
                        account_number=safe_str(data.get("account_number")),
                        ifsc_code=safe_str(data.get("ifsc_code")),
                        account_holder_name=safe_str(data.get("account_holder_name")),
                    ))
                summary["vendors"] += 1
            except Exception as e:
                summary["errors"].append(f"Vendors row {row_num}: {e}")

    # ── CUSTOMERS ──
    if "Customers" in wb.sheetnames:
        ws = wb["Customers"]
        headers = [c.value for c in ws[1]]
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                existing = db.query(Customer).filter(
                    func.lower(Customer.name) == name.lower(),
                    Customer.company_id == company_id
                ).first()
                if not existing:
                    db.add(Customer(
                        company_id=company_id,
                        name=name,
                        gstin=safe_str(data.get("gstin")),
                        pan=safe_str(data.get("pan")),
                        address=safe_str(data.get("address")),
                        state=safe_str(data.get("state")),
                        state_code=safe_str(data.get("state_code")),
                        phone=safe_str(data.get("phone")),
                        email=safe_str(data.get("email")),
                        bank_name=safe_str(data.get("bank_name")),
                        account_number=safe_str(data.get("account_number")),
                        ifsc_code=safe_str(data.get("ifsc_code")),
                        account_holder_name=safe_str(data.get("account_holder_name")),
                    ))
                summary["customers"] += 1
            except Exception as e:
                summary["errors"].append(f"Customers row {row_num}: {e}")

    db.commit()
    return {"message": "Import completed", "summary": summary}


@router.get("/template")
def download_template():
    """Generates a blank Excel template with the correct headers."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    items_ws = wb.create_sheet("Items")
    items_ws.append(["name", "code", "item_type", "hsn_code", "unit", "tax_rate", "opening_stock", "purchase_price", "tracking_type"])
    items_ws.append(["6 X 50 HEX NUTS", "2589", "raw_material", "7318", "pcs", 18, 100, 5, "bulk"])

    vendors_ws = wb.create_sheet("Vendors")
    vendors_ws.append(["name", "gstin", "pan", "address", "state", "state_code", "phone", "email", "bank_name", "account_number", "ifsc_code", "account_holder_name"])
    vendors_ws.append(["SAP PVT LTD", "27ABCDE1234F1Z5", "ABCDE1234F", "Sample Address", "Maharashtra", "27", "9999999999", "vendor@example.com", "", "", "", ""])

    customers_ws = wb.create_sheet("Customers")
    customers_ws.append(["name", "gstin", "pan", "address", "state", "state_code", "phone", "email", "bank_name", "account_number", "ifsc_code", "account_holder_name"])
    customers_ws.append(["ABC Motors", "27XYZAB1234F1Z5", "XYZAB1234F", "Sample Address", "Maharashtra", "27", "8888888888", "customer@example.com", "", "", "", ""])

    import io
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=import_template.xlsx"}
    )