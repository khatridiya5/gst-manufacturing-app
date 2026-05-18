from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.worker import Worker
from app.utils.auth import get_current_user, require_role
from app.models.user import User
from app.services.qr import generate_qr_base64, generate_worker_qr_data
from app.utils.otp import verify_delete_otp

router = APIRouter(prefix="/workers", tags=["Workers"])

# ─── SCHEMAS ─────────────────────────────────────────────────

class WorkerCreate(BaseModel):
    name: str
    department: Optional[str] = None
    phone: Optional[str] = None

class WorkerOut(BaseModel):
    id: int
    name: str
    worker_code: str
    department: Optional[str]
    phone: Optional[str]
    qr_code_data: Optional[str]
    is_active: bool
    class Config:
        from_attributes = True

class WorkerWithQR(WorkerOut):
    qr_code_image: Optional[str]

# ─── CREATE WORKER ────────────────────────────────────────────

@router.post("/", response_model=WorkerOut)
def create_worker(
    data: WorkerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    # Auto-generate worker code
    count = db.query(Worker).filter(
        Worker.company_id == current_user.company_id
    ).count()
    worker_code = f"W{str(count + 1).zfill(3)}"

    # Generate QR
    qr_data = generate_worker_qr_data(worker_code, data.name)
    qr_image = generate_qr_base64(qr_data)

    worker = Worker(
        company_id=current_user.company_id,
        name=data.name,
        worker_code=worker_code,
        department=data.department,
        phone=data.phone,
        qr_code_data=qr_data,
        qr_code_image=qr_image
    )
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker

# ─── GET ALL WORKERS ─────────────────────────────────────────

@router.get("/", response_model=List[WorkerOut])
def get_workers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Worker).filter(
        Worker.company_id == current_user.company_id,
        Worker.is_active == True
    ).all()

# ─── GET WORKER QR CARD ───────────────────────────────────────

@router.get("/{worker_id}/qr", response_model=WorkerWithQR)
def get_worker_qr(
    worker_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    worker = db.query(Worker).filter(
        Worker.id == worker_id,
        Worker.company_id == current_user.company_id
    ).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker

# ─── DEACTIVATE WORKER ────────────────────────────────────────

@router.delete("/{worker_id}")
def delete_worker(
    worker_id: int,
    otp: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    # 1. Verify OTP first
    if not verify_delete_otp(otp):
        raise HTTPException(status_code=403, detail="Invalid OTP")

    worker = db.query(Worker).filter(
        Worker.id == worker_id,
        Worker.company_id == current_user.company_id
    ).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # 2. Delete related WIP scans
    db.query(WIPScan).filter(WIPScan.worker_id == worker_id).delete(synchronize_session=False)

    # 3. Delete the worker
    db.delete(worker)
    db.commit()
    return {"message": "Worker deleted successfully"}
  

# ─── LOOKUP BY QR SCAN ────────────────────────────────────────

@router.get("/scan/{qr_data}")
def lookup_by_qr(
    qr_data: str,
    db: Session = Depends(get_db)
):
    """Called when a worker scans their QR card on the shop floor"""
    worker = db.query(Worker).filter(
        Worker.qr_code_data == qr_data
    ).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {
        "worker_id": worker.id,
        "name": worker.name,
        "worker_code": worker.worker_code,
        "department": worker.department
    }

