from passlib.context import CryptContext
from app.database import SessionLocal
from app.models.section_credentials import SectionCredential

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()

sections = [
    ("purchase",   "purchase@siders.in",   "Purchase@123"),
    ("production", "production@siders.in", "Produc@456"),
    ("sales",      "sales@siders.in",      "Sales@789"),
]

for section, username, password in sections:
    exists = db.query(SectionCredential).filter_by(section=section).first()
    if not exists:
        db.add(SectionCredential(
            section=section,
            username=username,
            hashed_password=pwd.hash(password),
            company_id=1
        ))
        print(f"✅ {section} created")
    else:
        print(f"⚠️  {section} already exists")

db.commit()
db.close()