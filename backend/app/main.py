from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, master, purchase, workers, production, sales, gst, accounting

app = FastAPI(title="GST Manufacturing App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

@app.get("/")
def root():
    return {"message": "GST Manufacturing API is running"}