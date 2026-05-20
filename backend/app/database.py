from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def make_first_user_admin():
    db = SessionLocal()
    try:
        from app.models.user import User
        users = db.query(User).order_by(User.id).all()
        if users:
            first_user = users[0]
            if first_user.role != "admin":
                first_user.role = "admin"
                db.commit()
                print(f"✅ {first_user.email} set as admin")
    finally:
        db.close()