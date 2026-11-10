"""
Insurance product, quotation, and application service.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.insurance import (
    APPLICATION_STATUSES,
    InsuranceApplication,
    InsuranceProduct,
    ProductCoverage,
    ProductExclusion,
    Quotation,
    UnderwritingReview,
)
from app.models.shipment import Shipment
from app.models.user import User
from app.services.pricing_service import calculate_premium

QUOTATION_VALIDITY_DAYS = 14

CANONICAL_PRODUCTS = [
    {
        "product_code": "MCI",
        "product_name": "Marine Cargo Insurance",
        "description": "Comprehensive all-risks cargo protection for maritime shipping covering loss, damage, theft, and natural perils.",
        "base_rate": Decimal("0.0050"),
        "min_insured_value": Decimal("10000.00"),
        "max_insured_value": Decimal("50000000.00"),
        "deductible_percentage": Decimal("5.00"),
        "min_deductible": Decimal("5000.00"),
        "applicable_modes": "sea,multimodal",
        "coverage_duration_days": 45,
        "terms_and_conditions": "Institute Cargo Clauses (A). Subject to warranty of seaworthiness and proper packaging.",
        "coverages": ["Total Cargo Loss", "Water Damage & Heavy Weather", "Jettison & Washing Overboard", "General Average Contribution"],
        "exclusions": ["Willful misconduct", "Ordinary leakage and loss in weight", "Improper or insufficient packaging"],
    },
    {
        "product_code": "ICI",
        "product_name": "Import Cargo Insurance",
        "description": "Tailored coverage for goods imported across international borders from overseas port of loading to final inland destination.",
        "base_rate": Decimal("0.0055"),
        "min_insured_value": Decimal("25000.00"),
        "max_insured_value": Decimal("100000000.00"),
        "deductible_percentage": Decimal("5.00"),
        "min_deductible": Decimal("7500.00"),
        "applicable_modes": "sea,air,multimodal",
        "coverage_duration_days": 60,
        "terms_and_conditions": "Institute Cargo Clauses (A) with Customs Duty extension. Covers port-to-warehouse transit.",
        "coverages": ["Port Handling Damage", "Customs Inspection Mishaps", "Transit Collision & Overturning", "Theft & Pilferage"],
        "exclusions": ["Customs confiscation or delay", "Inherent vice of cargo", "Demurrage charges"],
    },
    {
        "product_code": "ECI",
        "product_name": "Export Cargo Insurance",
        "description": "Protection for exporters covering cargo from factory or warehouse dispatch through international delivery port.",
        "base_rate": Decimal("0.0052"),
        "min_insured_value": Decimal("25000.00"),
        "max_insured_value": Decimal("100000000.00"),
        "deductible_percentage": Decimal("5.00"),
        "min_deductible": Decimal("7500.00"),
        "applicable_modes": "sea,air,multimodal",
        "coverage_duration_days": 60,
        "terms_and_conditions": "Institute Cargo Clauses (A) CIF/FOB terms. Includes loading at origin warehouse.",
        "coverages": ["Warehouse-to-Warehouse Risk", "Loading & Unloading Accidents", "Container Damage & Loss", "Perils of the Sea"],
        "exclusions": ["Non-delivery due to political trade sanctions", "Insolvency of carriers"],
    },
    {
        "product_code": "ITI",
        "product_name": "Inland Transit Insurance",
        "description": "Coverage for domestic transportation of goods across road, rail, and inland waterways.",
        "base_rate": Decimal("0.0035"),
        "min_insured_value": Decimal("5000.00"),
        "max_insured_value": Decimal("20000000.00"),
        "deductible_percentage": Decimal("2.50"),
        "min_deductible": Decimal("2500.00"),
        "applicable_modes": "road,rail",
        "coverage_duration_days": 15,
        "terms_and_conditions": "Inland Transit (Rail/Road) Clause A. Valid for domestic transit within national borders.",
        "coverages": ["Vehicle Overturning & Derailment", "Fire, Explosion & Lightning", "Theft of Entire Consignment", "Bridge Collapse"],
        "exclusions": ["Driver negligence / unlicensed vehicle", "Overloading beyond legal weight limit"],
    },
    {
        "product_code": "VBI",
        "product_name": "Voyage-Based Insurance",
        "description": "Single-trip policy custom-configured for one specific voyage between named origin and destination points.",
        "base_rate": Decimal("0.0048"),
        "min_insured_value": Decimal("10000.00"),
        "max_insured_value": Decimal("30000000.00"),
        "deductible_percentage": Decimal("5.00"),
        "min_deductible": Decimal("5000.00"),
        "applicable_modes": "sea,air,road,rail,multimodal",
        "coverage_duration_days": 30,
        "terms_and_conditions": "Institute Cargo Clauses (B). Covers specified single voyage with fixed departure window.",
        "coverages": ["Vessel Sinking or Stranding", "Fire or Explosion", "Discharge of Cargo at Distress Port"],
        "exclusions": ["Unreasonable route deviation", "Delayed arrival penalty"],
    },
    {
        "product_code": "AOP",
        "product_name": "Annual Open Marine Policy",
        "description": "Continuous, automatic cover for regular traders covering all declared shipments over a 12-month period.",
        "base_rate": Decimal("0.0040"),
        "min_insured_value": Decimal("100000.00"),
        "max_insured_value": Decimal("200000000.00"),
        "deductible_percentage": Decimal("3.00"),
        "min_deductible": Decimal("10000.00"),
        "applicable_modes": "sea,air,road,rail,multimodal",
        "coverage_duration_days": 365,
        "terms_and_conditions": "Annual Open Policy wording. Requires monthly declaration of shipments under cover limit.",
        "coverages": ["Automatic Cover on Dispatch", "Pre-agreed Premium Rates", "Global Transit Coverage", "Cumulative Loss Protection"],
        "exclusions": ["Undeclared shipments", "Exceeded single carrying limit"],
    },
    {
        "product_code": "SCC",
        "product_name": "Specialized Cargo Coverage",
        "description": "Specialized coverage for high-value, temperature-controlled, hazardous, or oversized cargo requiring custom risk controls.",
        "base_rate": Decimal("0.0075"),
        "min_insured_value": Decimal("50000.00"),
        "max_insured_value": Decimal("150000000.00"),
        "deductible_percentage": Decimal("7.50"),
        "min_deductible": Decimal("15000.00"),
        "applicable_modes": "sea,air,road,multimodal",
        "coverage_duration_days": 45,
        "terms_and_conditions": "Institute Specialized Clauses including Reefer / Hazardous Cargo warranties. Pre-shipment survey required.",
        "coverages": ["Refrigeration Breakdown & Thawing", "Oversized Structural Strain", "Hazardous Material Leakage Containment", "High-Value Cargo Armed Escort"],
        "exclusions": ["Failure of pre-cooling inspection", "Incorrect temperature settings log"],
    },
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def seed_insurance_products(db: Session) -> None:
    """Populate database with the 7 canonical MarineSure products."""
    existing_codes = {p.product_code for p in db.query(InsuranceProduct.product_code).all()}
    for data in CANONICAL_PRODUCTS:
        if data["product_code"] not in existing_codes:
            coverages = data.get("coverages", [])
            exclusions = data.get("exclusions", [])
            product = InsuranceProduct(
                product_code=data["product_code"],
                product_name=data["product_name"],
                description=data["description"],
                base_rate=data["base_rate"],
                min_insured_value=data["min_insured_value"],
                max_insured_value=data["max_insured_value"],
                deductible_percentage=data["deductible_percentage"],
                min_deductible=data["min_deductible"],
                applicable_modes=data["applicable_modes"],
                coverage_duration_days=data["coverage_duration_days"],
                terms_and_conditions=data["terms_and_conditions"],
                status="active",
            )
            for c in coverages:
                product.coverages.append(ProductCoverage(coverage_name=c))
            for e in exclusions:
                product.exclusions.append(ProductExclusion(exclusion_name=e))
            db.add(product)
    db.commit()


def next_quotation_number(db: Session) -> str:
    count = db.query(Quotation).count() + 1
    return f"QT-{_now():%Y}-{count:06d}"


def next_application_number(db: Session) -> str:
    count = db.query(InsuranceApplication).count() + 1
    return f"AP-{_now():%Y}-{count:06d}"


def list_products(db: Session, include_inactive: bool = False) -> list[InsuranceProduct]:
    if not db.query(InsuranceProduct.id).first():
        seed_insurance_products(db)
    q = db.query(InsuranceProduct).filter(InsuranceProduct.is_deleted == 0)
    if not include_inactive:
        q = q.filter(InsuranceProduct.status == "active")
    return q.order_by(InsuranceProduct.product_code).all()


def _require_active(product: InsuranceProduct) -> InsuranceProduct:
    if product.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This insurance product is not currently offered")
    return product


def get_product(db: Session, product_id: str) -> InsuranceProduct:
    product = db.get(InsuranceProduct, product_id)
    if product is None or product.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insurance product not found")
    return product


def create_quotation(db: Session, user: User, shipment_id: str, product_id: str) -> Quotation:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None or shipment.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shipment not found")

    # Ownership verification
    if shipment.customer_id != user.id and not (set(user.role_names) & {"admin", "insurance_officer", "senior_officer"}):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this shipment")

    product = _require_active(get_product(db, product_id))

    # Cargo category from first item, or general
    cargo_category = shipment.cargo_items[0].category if shipment.cargo_items else "general"
    insured_value = shipment.declared_value

    if insured_value < product.min_insured_value:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Cargo value ({insured_value}) is below minimum for {product.product_name} ({product.min_insured_value})",
        )
    if insured_value > product.max_insured_value:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Cargo value ({insured_value}) exceeds maximum for {product.product_name} ({product.max_insured_value})",
        )

    pricing = calculate_premium(
        insured_value=insured_value,
        base_rate=product.base_rate,
        cargo_category=cargo_category,
        transport_mode=shipment.transport_mode,
        deductible_percent=product.deductible_percentage,
        min_deductible=product.min_deductible,
    )

    quotation = Quotation(
        quotation_number=next_quotation_number(db),
        customer_id=shipment.customer_id,
        shipment_id=shipment.id,
        product_id=product.id,
        insured_value=pricing["insured_value"],
        rate_applied=pricing["rate_applied"],
        base_premium=pricing["base_premium"],
        additional_charges=pricing["additional_charges"],
        tax_amount=pricing["tax_amount"],
        total_premium=pricing["total_premium"],
        deductible_amount=pricing["deductible_amount"],
        currency=shipment.currency,
        status="active",
        valid_until=_now() + timedelta(days=QUOTATION_VALIDITY_DAYS),
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


def compare_products_for_shipment(db: Session, user: User, shipment_id: str) -> list[dict]:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None or shipment.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shipment not found")

    products = list_products(db)
    results = []

    cargo_category = shipment.cargo_items[0].category if shipment.cargo_items else "general"
    insured_value = shipment.declared_value

    for p in products:
        notes = []
        is_eligible = True

        # Check transport mode compatibility
        allowed_modes = [m.strip().lower() for m in p.applicable_modes.split(",")]
        if shipment.transport_mode.lower() not in allowed_modes and "all" not in allowed_modes:
            is_eligible = False
            notes.append(f"Does not support {shipment.transport_mode} transport")

        # Check insured value limits
        if insured_value < p.min_insured_value:
            is_eligible = False
            notes.append(f"Below min value {p.min_insured_value}")
        if insured_value > p.max_insured_value:
            is_eligible = False
            notes.append(f"Exceeds max value {p.max_insured_value}")

        pricing = calculate_premium(
            insured_value=insured_value,
            base_rate=p.base_rate,
            cargo_category=cargo_category,
            transport_mode=shipment.transport_mode,
            deductible_percent=p.deductible_percentage,
            min_deductible=p.min_deductible,
        )

        quote_data = {
            "id": "estimate",
            "quotation_number": "PREVIEW",
            "customer_id": shipment.customer_id,
            "shipment_id": shipment.id,
            "product_id": p.id,
            "product_name": p.product_name,
            "insured_value": pricing["insured_value"],
            "rate_applied": pricing["rate_applied"],
            "base_premium": pricing["base_premium"],
            "additional_charges": pricing["additional_charges"],
            "tax_amount": pricing["tax_amount"],
            "total_premium": pricing["total_premium"],
            "deductible_amount": pricing["deductible_amount"],
            "currency": shipment.currency,
            "status": "active",
            "valid_until": _now() + timedelta(days=QUOTATION_VALIDITY_DAYS),
            "created_at": _now(),
        }

        results.append({
            "product": p,
            "quotation": quote_data,
            "is_eligible": is_eligible,
            "eligibility_notes": notes,
        })

    return results


def submit_application(db: Session, user: User, data) -> InsuranceApplication:
    shipment = db.get(Shipment, data.shipment_id)
    if shipment is None or shipment.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shipment not found")

    if shipment.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this shipment")

    product = _require_active(get_product(db, data.product_id))

    cargo_category = shipment.cargo_items[0].category if shipment.cargo_items else "general"
    pricing = calculate_premium(
        insured_value=data.requested_insured_amount,
        base_rate=product.base_rate,
        cargo_category=cargo_category,
        transport_mode=shipment.transport_mode,
        deductible_percent=product.deductible_percentage,
        min_deductible=product.min_deductible,
    )

    app_record = InsuranceApplication(
        application_number=next_application_number(db),
        customer_id=user.id,
        shipment_id=shipment.id,
        product_id=product.id,
        quotation_id=data.quotation_id,
        requested_insured_amount=data.requested_insured_amount,
        calculated_premium=pricing["total_premium"],
        status="submitted",
        special_conditions=data.special_conditions,
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record


def list_applications(db: Session, user: User) -> list[InsuranceApplication]:
    roles = set(user.role_names)
    if roles & {"admin", "insurance_officer", "senior_officer"}:
        return db.query(InsuranceApplication).order_by(InsuranceApplication.created_at.desc()).all()
    return (
        db.query(InsuranceApplication)
        .filter(InsuranceApplication.customer_id == user.id)
        .order_by(InsuranceApplication.created_at.desc())
        .all()
    )


def get_application(db: Session, user: User, app_id: str) -> InsuranceApplication:
    app_record = db.get(InsuranceApplication, app_id)
    if app_record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Insurance application not found")
    roles = set(user.role_names)
    if app_record.customer_id != user.id and not (roles & {"admin", "insurance_officer", "senior_officer"}):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return app_record


def review_application(
    db: Session, officer: User, app_id: str, data
) -> InsuranceApplication:
    roles = set(officer.role_names)
    if not (roles & {"insurance_officer", "senior_officer", "admin"}):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only insurance officers can review applications")

    app_record = db.get(InsuranceApplication, app_id)
    if app_record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")

    if app_record.status not in ("submitted", "under_review", "documents_required"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Application in status '{app_record.status}' cannot be reviewed"
        )

    # High-value referral rule: If requested amount > 50,00,000, senior officer must review
    HIGH_VALUE_THRESHOLD = Decimal("5000000.00")
    if app_record.requested_insured_amount >= HIGH_VALUE_THRESHOLD and "senior_officer" not in roles and "admin" not in roles:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "High-value applications (₹50,00,000+) require approval from a Senior Insurance Officer",
        )

    review = UnderwritingReview(
        application_id=app_record.id,
        officer_id=officer.id,
        risk_score=data.risk_score,
        risk_remarks=data.risk_remarks,
        decision=data.decision,
    )
    db.add(review)

    if data.decision == "approved":
        app_record.status = "approved"
    elif data.decision == "rejected":
        app_record.status = "rejected"
    elif data.decision == "documents_required":
        app_record.status = "documents_required"

    app_record.officer_remarks = data.officer_remarks
    app_record.reviewed_by = officer.id
    app_record.reviewed_at = _now()

    db.commit()
    db.refresh(app_record)
    return app_record
