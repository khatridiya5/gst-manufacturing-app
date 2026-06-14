from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User
from app.models.company import Company

router = APIRouter(prefix="/api/admin/clients", tags=["admin-clients"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CreateClientRequest(BaseModel):
    company_name: str
    gstin: str
    state: str
    state_code: str
    pan: str | None = None
    address: str | None = None
    phone: str | None = None
    company_email: str | None = None
    admin_name: str
    admin_email: EmailStr
    admin_password: str


@router.post("", status_code=201)
def create_client(body: CreateClientRequest, db: Session = Depends(get_db)):
    if db.query(Company).filter(Company.gstin == body.gstin).first():
        raise HTTPException(status_code=400, detail="A company with this GSTIN already exists")
    if db.query(User).filter(User.email == body.admin_email).first():
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    if len(body.admin_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    company = Company(
        name=body.company_name,
        gstin=body.gstin,
        pan=body.pan,
        address=body.address,
        state=body.state,
        state_code=body.state_code,
        phone=body.phone,
        email=body.company_email,
    )
    db.add(company)
    db.flush()

    admin = User(
        name=body.admin_name,
        email=body.admin_email,
        hashed_password=pwd_context.hash(body.admin_password),
        company_id=company.id,
        role="admin",
    )
    db.add(admin)
    db.commit()
    db.refresh(company)
    db.refresh(admin)

    return {
        "status": "ok",
        "company_id": company.id,
        "company_name": company.name,
        "admin_email": admin.email,
        "admin_id": admin.id,
    }


@router.get("")
def list_clients(db: Session = Depends(get_db)):
    companies = db.query(Company).all()
    result = []
    for c in companies:
        admins = db.query(User).filter(User.company_id == c.id, User.role == "admin").all()
        result.append({
            "id": c.id,
            "name": c.name,
            "gstin": c.gstin,
            "state": c.state,
            "phone": c.phone,
            "email": c.email,
            "admins": [{"id": a.id, "name": a.name, "email": a.email, "is_active": a.is_active} for a in admins],
            "created_at": str(c.created_at),
        })
    return result


@router.patch("/{user_id}/toggle-active")
def toggle_admin_active(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"status": "ok", "is_active": user.is_active}