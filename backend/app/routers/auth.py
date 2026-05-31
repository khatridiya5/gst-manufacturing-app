from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.section_credentials import SectionCredential
from app.utils.auth import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_EMAIL = "admin"
ALLOWED_PASSWORD="me"
SECTION_CREDENTIALS = {
    "purchase":   {"username": "purchase",    "password": "buy@2024"},
    "sales":      {"username": "sales",       "password": "sell@2024"},
    "production": {"username": "production",  "password": "prod@2024"},
    "store":      {"username": "store",       "password": "stock@2024"},
}
# ── Schemas ──────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str

class SectionCredentialRequest(BaseModel):
    section: str
    username: str
    password: str

class SectionLoginRequest(BaseModel):
    section: str
    username: str
    password: str

# ── Helpers ──────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_current_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ── Auth Routes ───────────────────────────────────────────────
@router.post("/register", status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if body.email != ALLOWED_EMAIL:
        raise HTTPException(status_code=403, detail="Registration is not open")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    company_name = body.company_name or f"{body.name}'s Company"
    company = Company(
        name=company_name,
        gstin="PENDING",
        state="PENDING",
        state_code="00",
    )
    db.add(company)
    db.flush()

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        company_id=company.id,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created successfully", "id": user.id, "company_id": company.id}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    if form.username != ALLOWED_EMAIL or form.password != ALLOWED_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get the first admin user in DB (don't look up by email)
    user = db.query(User).filter(User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=401, detail="No admin user found in DB")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({
        "user_id": user.id,
        "role": "admin",
        "company_id": user.company_id,
    })
    return {"access_token": token, "token_type": "bearer", "role": "admin"}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "company_id": current_user.company_id,
    }


# ── Setup Status ──────────────────────────────────────────────
@router.get("/setup/status")
def setup_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    required = {"purchase", "sales", "production"}
    saved = db.query(SectionCredential).filter_by(company_id=current_user.company_id).all()
    saved_sections = {s.section for s in saved}
    complete = required.issubset(saved_sections)
    return {
        "setup_complete": complete,
        "saved": list(saved_sections),
        "missing": list(required - saved_sections),
    }


# ── Section Credential Routes ─────────────────────────────────
@router.post("/setup/section-credentials", status_code=201)
def save_section_credential(
    body: SectionCredentialRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    allowed = {"purchase", "sales", "production", "store"}
    if body.section not in allowed:
        raise HTTPException(status_code=422, detail=f"section must be one of {allowed}")
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    existing = db.query(SectionCredential).filter_by(
        section=body.section,
        company_id=current_user.company_id
    ).first()
    hashed = hash_password(body.password)

    if existing:
        existing.username = body.username
        existing.hashed_password = hashed
    else:
        cred = SectionCredential(
            section=body.section,
            username=body.username,
            hashed_password=hashed,
            company_id=current_user.company_id,
        )
        db.add(cred)

    db.commit()
    return {"message": f"{body.section} credentials saved successfully"}


@router.post("/section-login")
def section_login(body: SectionLoginRequest, db: Session = Depends(get_db)):
    allowed = {"purchase", "sales", "production", "store"}
    if body.section not in allowed:
        raise HTTPException(status_code=422, detail=f"section must be one of {allowed}")

    cred = SECTION_CREDENTIALS.get(body.section)
    if body.username != cred["username"] or body.password != cred["password"]:
        raise HTTPException(status_code=401, detail="Invalid section credentials")

    role = "store_manager" if body.section == "store" else body.section
    token = create_access_token({"section": body.section, "role": role})
    return {"access_token": token, "token_type": "bearer", "role": role, "section": body.section}


@router.get("/setup/section-credentials")
def list_section_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    creds = db.query(SectionCredential).filter_by(company_id=current_user.company_id).all()
    return [{"section": c.section, "username": c.username} for c in creds]


@router.delete("/setup/section-credentials/{section}")
def delete_section_credential(
    section: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    cred = db.query(SectionCredential).filter_by(
        section=section,
        company_id=current_user.company_id
    ).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(cred)
    db.commit()
    return {"message": f"{section} credentials removed"}


@router.post("/fix-admin")
def fix_admin(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = "admin"
    db.commit()
    return {"message": f"{email} is now admin"}