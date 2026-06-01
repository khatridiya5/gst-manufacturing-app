from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, master, purchase, workers, production, sales, gst, accounting, inventory
from app.database import SessionLocal, engine, Base
from app.models import user, company, section_credentials
from app.routers import issue_items

app = FastAPI(title="GST Manufacturing App")
# Creates all missing tables automatically on startup
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(master.router)
app.include_router(purchase.router)
app.include_router(workers.router)
app.include_router(production.router)
app.include_router(sales.router)
app.include_router(gst.router)
app.include_router(accounting.router)
app.include_router(inventory.router)
app.include_router(issue_items.router)

@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        from app.models.user import User
        first_user = db.query(User).order_by(User.id).first()
        if first_user and first_user.role != "admin":
            first_user.role = "admin"
            db.commit()
            print(f"✅ Startup: {first_user.email} promoted to admin")
    except Exception as e:
        print(f"⚠️ Startup admin check failed: {e}")
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "GST Manufacturing API is running"}