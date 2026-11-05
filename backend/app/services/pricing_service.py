"""
MarineSure 2.0 – Premium Calculation & Pricing Engine

All calculations are strictly backend-controlled.
Base Premium = Insured Value * Applicable Rate
Total Premium = Base Premium + Additional Charges + Applicable Taxes (18% GST)
"""

from decimal import Decimal, ROUND_HALF_UP

GST_RATE = Decimal("0.18")
STANDARD_ADDITIONAL_CHARGES = Decimal("500.00")

CATEGORY_MULTIPLIERS = {
    "electronics": Decimal("1.30"),
    "fragile": Decimal("1.40"),
    "hazardous": Decimal("1.50"),
    "perishable": Decimal("1.35"),
    "machinery": Decimal("1.10"),
    "textiles": Decimal("1.00"),
    "general": Decimal("1.00"),
}

MODE_MULTIPLIERS = {
    "air": Decimal("0.85"),
    "sea": Decimal("1.00"),
    "rail": Decimal("1.10"),
    "road": Decimal("1.25"),
    "multimodal": Decimal("1.20"),
}


def round_curr(val: Decimal) -> Decimal:
    """Round monetary amounts to 2 decimal places using standard half-up rounding."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def round_rate(val: Decimal) -> Decimal:
    """Round percentage rates to 4 decimal places."""
    return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def calculate_premium(
    insured_value: Decimal,
    base_rate: Decimal,
    cargo_category: str = "general",
    transport_mode: str = "sea",
    additional_fee: Decimal = STANDARD_ADDITIONAL_CHARGES,
    deductible_percent: Decimal = Decimal("5.00"),
    min_deductible: Decimal = Decimal("5000.00"),
) -> dict:
    """
    Calculate full premium quotation breakdown.
    """
    # 1. Determine effective rate using category and mode multipliers
    cat_mult = CATEGORY_MULTIPLIERS.get(cargo_category.lower(), Decimal("1.00"))
    mode_mult = MODE_MULTIPLIERS.get(transport_mode.lower(), Decimal("1.00"))
    effective_rate = round_rate(base_rate * cat_mult * mode_mult)

    # 2. Base Premium = Insured Value * Effective Rate
    base_premium = round_curr(insured_value * effective_rate)

    # 3. Subtotal before tax
    subtotal = base_premium + additional_fee

    # 4. Tax (18% GST)
    tax_amount = round_curr(subtotal * GST_RATE)

    # 5. Total Premium
    total_premium = subtotal + tax_amount

    # 6. Deductible
    pct_deductible = round_curr(insured_value * (deductible_percent / Decimal("100.00")))
    deductible_amount = max(pct_deductible, min_deductible)

    return {
        "insured_value": insured_value,
        "rate_applied": effective_rate,
        "base_premium": base_premium,
        "additional_charges": additional_fee,
        "tax_amount": tax_amount,
        "total_premium": total_premium,
        "deductible_amount": deductible_amount,
    }
