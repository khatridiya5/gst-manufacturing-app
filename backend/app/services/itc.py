from decimal import Decimal

def calculate_tax(subtotal: Decimal, tax_rate: Decimal, is_interstate: bool):
    total_tax = subtotal * tax_rate / 100
    if is_interstate:
        return {
            "cgst": Decimal("0.00"),
            "sgst": Decimal("0.00"),
            "igst": round(total_tax, 2)
        }
    else:
        half_tax = round(total_tax / 2, 2)
        return {
            "cgst": half_tax,
            "sgst": half_tax,
            "igst": Decimal("0.00")
        }

def is_interstate_transaction(company_state_code: str, other_state_code: str) -> bool:
    return company_state_code != other_state_code