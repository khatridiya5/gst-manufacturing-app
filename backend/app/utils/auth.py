from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")

        if user_id is None:
            section = payload.get("section")
            if section not in ("purchase", "production", "sales", "store"):
                raise credentials_exception
            dummy = User()
            dummy.id = 0
            dummy.role = "store_manager" if section == "store" else section
            dummy.company_id = 1
            dummy.is_active = True
            return dummy

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    # ← removed hardcoded admin, use actual role from DB
    return user

def require_role(*roles):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to do this"
            )
        return current_user
    return role_checker



class CreateUserRequest(BaseModel):
    email: str
    password: str
    role: str  # "admin", "accountant", "store_manager", "production", "sales"

@router.post("/users/create")
def create_user(
    data: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    user = User(
        email=data.email,
        hashed_password=pwd_context.hash(data.password),
        role=data.role,
        company_id=current_user.company_id,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": f"User {data.email} created with role {data.role}"}

@router.get("/users")
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    users = db.query(User).filter(User.company_id == current_user.company_id).all()
    return [{"id": u.id, "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]
