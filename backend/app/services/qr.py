import qrcode
import base64
from io import BytesIO

def generate_qr_base64(data: str) -> str:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode()

# REPLACE WITH THIS:
def generate_part_qr_data(item_type: str, item_code: str, po_number: str, unit_number: int, tracking_type: str = 'unit') -> str:
    code = item_code.upper().replace(" ", "")[:8]
    if tracking_type == 'bulk':
        return f"BULK-{code}-{po_number}"   # one QR for whole batch
    else:
        return f"UNIT-{code}-{po_number}-{unit_number:04d}"  # one QR per piece

def generate_worker_qr_data(worker_code: str, worker_name: str) -> str:
    name = worker_name.upper().replace(" ", "")[:8]
    return f"WK-{worker_code}-{name}"