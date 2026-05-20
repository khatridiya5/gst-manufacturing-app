from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User
from app.models.section_credentials import SectionCredential
from app.utils.auth import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Schemas ──────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_id: int | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str

class SectionCredentialRequest(BaseModel):
    section: str        # "purchase", "sales", "production"
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
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
        company_id=body.company_id,
        role="staff",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created successfully", "id": user.id}


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({
        "user_id": user.id,
        "role": user.role,
        "company_id": user.company_id,
    })
    return {"access_token": token, "token_type": "bearer", "role": user.role}


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
    current_user: User = Depends(get_current_user)
):
    """
    Called right after admin login to decide whether to show
    /setup page or go straight to /dashboard.
    """
    required = {"purchase", "sales", "production"}
    saved = db.query(SectionCredential).all()
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
    current_user: User = Depends(get_current_admin),   # admin only
):
    """
    Admin sets username+password for a section (purchase/sales/production).
    Upserts — safe to call again if admin wants to change credentials.
    """
    allowed = {"purchase", "sales", "production"}
    if body.section not in allowed:
        raise HTTPException(status_code=422, detail=f"section must be one of {allowed}")
    if len(body.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")

    existing = db.query(SectionCredential).filter_by(section=body.section).first()
    hashed = hash_password(body.password)

    if existing:
        existing.username = body.username
        existing.hashed_password = hashed
    else:
        cred = SectionCredential(
            section=body.section,
            username=body.username,
            hashed_password=hashed,
        )
        db.add(cred)

    db.commit()
    return {"message": f"{body.section} credentials saved successfully"}


@router.post("/section-login")
def section_login(
    body: SectionLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Workers log in to a specific section using the section credentials.
    Returns a scoped token that only grants access to that section.
    """
    allowed = {"purchase", "sales", "production"}
    if body.section not in allowed:
        raise HTTPException(status_code=422, detail=f"section must be one of {allowed}")

    cred = db.query(SectionCredential).filter_by(section=body.section).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Section credentials not configured yet")
    if cred.username != body.username or not verify_password(body.password, cred.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid section credentials")

    # Scoped token — role is the section name so frontend can gate routes
    token = create_access_token({
        "section": body.section,
        "role": body.section,        # e.g. "purchase", "sales", "production"
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "section": body.section,
    }


@router.get("/setup/section-credentials")
def list_section_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """
    Admin can see which sections are configured (never returns passwords).
    """
    creds = db.query(SectionCredential).all()
    return [{"section": c.section, "username": c.username} for c in creds]


@router.delete("/setup/section-credentials/{section}")
def delete_section_credential(
    section: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
):
    """
    Admin can reset credentials for a section.
    """
    cred = db.query(SectionCredential).filter_by(section=section).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Section not found")
    db.delete(cred)
    db.commit()
    return {"message": f"{section} credentials removed"}