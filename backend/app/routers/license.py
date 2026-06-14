from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.license import License, RegisteredDevice
from app.models.company import Company

router = APIRouter(prefix="/api/license", tags=["license"])

class ActivateRequest(BaseModel):
    license_key: str
    device_fingerprint: str
    device_label: str | None = None

class VerifyRequest(BaseModel):
    license_key: str
    device_fingerprint: str
    username: str | None = None   # ✅ NEW
    password: str | None = None   # ✅ NEW


class CreateLicenseRequest(BaseModel):
    company_id: int
    license_key: str
    max_devices: int = 2
    valid_until: str | None = None  # "2026-12-31"
    allowed_username: str          # ✅ NEW
    allowed_password: str 


def _check_license_validity(lic: License):
    if lic.status != "active":
        raise HTTPException(status_code=403, detail=f"License is {lic.status}")
    if lic.valid_until and lic.valid_until < datetime.utcnow():
        raise HTTPException(status_code=403, detail="License has expired")


@router.post("/activate")
def activate(body: ActivateRequest, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.license_key == body.license_key).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Invalid license key")

    _check_license_validity(lic)

    existing = db.query(RegisteredDevice).filter_by(
        license_id=lic.id, device_fingerprint=body.device_fingerprint
    ).first()

    if existing:
        existing.last_seen = datetime.utcnow()
        db.commit()
        return {"status": "ok", "message": "Device already registered"}

    device_count = db.query(RegisteredDevice).filter_by(license_id=lic.id).count()
    if device_count >= lic.max_devices:
        raise HTTPException(
            status_code=403,
            detail=f"Device limit reached ({lic.max_devices}). Contact support to free up a slot."
        )

    new_device = RegisteredDevice(
        license_id=lic.id,
        device_fingerprint=body.device_fingerprint,
        device_label=body.device_label,
    )
    db.add(new_device)
    db.commit()
    return {"status": "ok", "message": "Device registered successfully"}


@router.post("/verify")
def verify(body: VerifyRequest, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.license_key == body.license_key).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Invalid license key")

    _check_license_validity(lic)

    # ✅ NEW: check credentials if license has them bound
    if lic.allowed_username and lic.allowed_password_hash:
        if not body.username or not body.password:
            raise HTTPException(status_code=401, detail="Credentials required for this license")
        if body.username != lic.allowed_username:
            raise HTTPException(status_code=401, detail="Invalid credentials for this license")
        if not pwd_context.verify(body.password, lic.allowed_password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials for this license")

    device = db.query(RegisteredDevice).filter_by(
        license_id=lic.id, device_fingerprint=body.device_fingerprint
    ).first()
    if not device:
        raise HTTPException(status_code=403, detail="This device is not registered for this license")

    device.last_seen = datetime.utcnow()
    db.commit()

    return {
        "status": "ok",
        "company_id": lic.company_id,
        "valid_until": lic.valid_until,
    }


@router.post("/admin/create")
def admin_create_license(body: CreateLicenseRequest, db: Session = Depends(get_db)):
    existing = db.query(License).filter(License.license_key == body.license_key).first()
    if existing:
        raise HTTPException(status_code=400, detail="License key already exists")
    # ✅ CORRECT
    lic = License(
        license_key=body.license_key,
        company_id=body.company_id,
        max_devices=body.max_devices,
        valid_until=datetime.strptime(body.valid_until, "%Y-%m-%d") if body.valid_until else None,  # ← comma here
        status="active",
        allowed_username=body.allowed_username,
        allowed_password_hash=pwd_context.hash(body.allowed_password)
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return {"status": "ok", "license_key": lic.license_key}

@router.get("/admin/list")
def admin_list_licenses(db: Session = Depends(get_db)):
    licenses = db.query(License).all()
    result = []
    for l in licenses:
        devices_used = db.query(RegisteredDevice).filter_by(license_id=l.id).count()
        company = db.query(Company).filter_by(id=l.company_id).first()
        result.append({
            "id": l.id,
            "license_key": l.license_key,
            "company": company.name if company else "Unknown",
            "company_id": l.company_id,
            "max_devices": l.max_devices,
            "devices_used": devices_used,
            "valid_until": str(l.valid_until.date()) if l.valid_until else None,
            "status": l.status,
            "created_at": str(l.created_at)
        })
    return result

@router.post("/admin/revoke/{license_key}")
def admin_revoke_license(license_key: str, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.license_key == license_key).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "revoked"
    db.commit()
    return {"status": "ok"}


@router.post("/admin/activate/{license_key}")
def admin_activate_license(license_key: str, db: Session = Depends(get_db)):
    lic = db.query(License).filter(License.license_key == license_key).first()
    if not lic:
        raise HTTPException(status_code=404, detail="License not found")
    lic.status = "active"
    db.commit()
    return {"status": "ok"}
