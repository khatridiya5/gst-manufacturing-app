import os

def verify_delete_otp(otp: str) -> bool:
    return otp == os.getenv("DELETE_OTP", "1234")