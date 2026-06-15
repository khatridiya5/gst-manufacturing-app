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
from app.models.worker import Worker
from app.services.qr import generate_qr_base64, generate_worker_qr_data

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

    summary = {"items": 0, "vendors": 0, "customers": 0, "workers": 0, "skipped": 0, "errors": []}

    # ── ITEMS ──
    if "Items" in wb.sheetnames:
        ws = wb["Items"]
        headers = [c.value for c in ws[1]]

        # ✅ FIX: load all existing item names once, instead of one query per row
        existing_items = {
            row[0].lower(): row[1]
            for row in db.query(Item.name, Item.id).filter(
                Item.company_id == company_id
            ).all()
        }
        # map of item_id -> Item object, loaded lazily only for rows that need updating
        items_by_id = {}

        new_stock_entries = []

        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                opening_qty = int(float(data.get("opening_stock") or 0))
                purchase_price = float(data.get("purchase_price") or 0)

                existing_id = existing_items.get(name.lower())

                if existing_id:
                    # Fetch the existing item only if we need to update its stock
                    if existing_id not in items_by_id:
                        items_by_id[existing_id] = db.query(Item).filter(
                            Item.id == existing_id
                        ).first()
                    item = items_by_id[existing_id]
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
                    # ✅ keep the new item in our lookup so a duplicate row later in
                    # the same file is recognised without another query
                    existing_items[name.lower()] = item.id
                    items_by_id[item.id] = item

                if opening_qty:
                    item.current_stock = (item.current_stock or 0) + opening_qty
                    new_stock_entries.append(StockLedger(
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

        # ✅ FIX: bulk-add stock ledger entries in one go instead of per-row commit overhead
        if new_stock_entries:
            db.add_all(new_stock_entries)

    # ── VENDORS ──
    if "Vendors" in wb.sheetnames:
        ws = wb["Vendors"]
        headers = [c.value for c in ws[1]]

        # ✅ FIX: load all existing vendor names once
        existing_vendor_names = {
            row[0].lower() for row in db.query(Vendor.name).filter(
                Vendor.company_id == company_id
            ).all()
        }

        new_vendors = []
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                if name.lower() in existing_vendor_names:
                    summary["skipped"] += 1
                    continue

                new_vendors.append(Vendor(
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
                existing_vendor_names.add(name.lower())  # avoid dup rows within same file
                summary["vendors"] += 1
            except Exception as e:
                summary["errors"].append(f"Vendors row {row_num}: {e}")

        if new_vendors:
            db.add_all(new_vendors)

    # ── CUSTOMERS ──
    if "Customers" in wb.sheetnames:
        ws = wb["Customers"]
        headers = [c.value for c in ws[1]]

        # ✅ FIX: load all existing customer names once
        existing_customer_names = {
            row[0].lower() for row in db.query(Customer.name).filter(
                Customer.company_id == company_id
            ).all()
        }

        new_customers = []
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                if name.lower() in existing_customer_names:
                    summary["skipped"] += 1
                    continue

                new_customers.append(Customer(
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
                existing_customer_names.add(name.lower())
                summary["customers"] += 1
            except Exception as e:
                summary["errors"].append(f"Customers row {row_num}: {e}")

        if new_customers:
            db.add_all(new_customers)

    # ── WORKERS ──
    if "Workers" in wb.sheetnames:
        ws = wb["Workers"]
        headers = [c.value for c in ws[1]]

        # ✅ FIX: load all existing worker names once
        existing_worker_names = {
            row[0].lower() for row in db.query(Worker.name).filter(
                Worker.company_id == company_id
            ).all()
        }

        # Find the last worker code already used, to continue numbering
        last_worker = db.query(Worker).filter(
            Worker.company_id == company_id
        ).order_by(Worker.id.desc()).first()

        if last_worker:
            next_num = int(last_worker.worker_code[1:]) + 1
        else:
            next_num = 1

        new_workers = []
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            data = dict(zip(headers, row))
            try:
                name = safe_str(data.get("name"))
                if not name:
                    summary["skipped"] += 1
                    continue

                if name.lower() in existing_worker_names:
                    summary["skipped"] += 1
                    continue

                worker_code = f"W{str(next_num).zfill(3)}"
                next_num += 1

                qr_data = generate_worker_qr_data(worker_code, name)
                qr_image = generate_qr_base64(qr_data)

                new_workers.append(Worker(
                    company_id=company_id,
                    name=name,
                    worker_code=worker_code,
                    department=safe_str(data.get("department")),
                    phone=safe_str(data.get("phone")),
                    qr_code_data=qr_data,
                    qr_code_image=qr_image
                ))
                existing_worker_names.add(name.lower())
                summary["workers"] += 1
            except Exception as e:
                summary["errors"].append(f"Workers row {row_num}: {e}")

        if new_workers:
            db.add_all(new_workers)

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

    workers_ws = wb.create_sheet("Workers")
    workers_ws.append(["name", "department", "phone"])
    workers_ws.append(["KUNJ PATEL", "Assembly", "9876543210"])

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