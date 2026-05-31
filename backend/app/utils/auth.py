# Hardcoded section credentials
SECTION_CREDENTIALS = {
    "purchase": {"username": "purchase", "password": "purchase123"},
    "production": {"username": "production", "password": "production123"},
    "sales": {"username": "sales", "password": "sales123"},
    "store": {"username": "store", "password": "store123"},
}

@router.post("/section-login")
def section_login(body: SectionLoginRequest, db: Session = Depends(get_db)):
    allowed = {"purchase", "sales", "production", "store"}
    if body.section not in allowed:
        raise HTTPException(status_code=422, detail=f"section must be one of {allowed}")

    creds = SECTION_CREDENTIALS.get(body.section)
    if body.username != creds["username"] or body.password != creds["password"]:
        raise HTTPException(status_code=401, detail="Invalid section credentials")

    role = "store_manager" if body.section == "store" else body.section
    token = create_access_token({"section": body.section, "role": role})
    return {"access_token": token, "token_type": "bearer", "role": role, "section": body.section}