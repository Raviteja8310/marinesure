"""
REST APIs for insurance products, quotations, and policy applications.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.user import User
from app.schemas.insurance import (
    ApplicationCreate,
    ApplicationOut,
    ProductComparisonItem,
    ProductOut,
    QuotationCreate,
    QuotationOut,
    UnderwritingReviewIn,
)
from app.services import insurance_service

router = APIRouter(tags=["Insurance Products & Underwriting"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


# ── Products ─────────────────────────────────────────────────────

@router.get("/insurance-products", response_model=list[ProductOut])
def get_products(db: Session = Depends(get_db)):
    """List all available marine insurance products."""
    return insurance_service.list_products(db)


@router.get("/insurance-products/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    """Get single product with coverage and exclusions."""
    return insurance_service.get_product(db, product_id)


# ── Quotations & Comparisons ─────────────────────────────────────

@router.post("/quotations", response_model=QuotationOut, status_code=201)
def generate_quotation(
    data: QuotationCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Generate official premium quotation for a registered shipment."""
    user = _user(db, payload)
    quote = insurance_service.create_quotation(db, user, data.shipment_id, data.product_id)
    return quote


@router.get("/shipments/{shipment_id}/compare-products", response_model=list[ProductComparisonItem])
def compare_products_for_shipment(
    shipment_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Compare all available insurance products against a specific shipment."""
    user = _user(db, payload)
    return insurance_service.compare_products_for_shipment(db, user, shipment_id)


# ── Applications ─────────────────────────────────────────────────

@router.post("/applications", response_model=ApplicationOut, status_code=201)
def submit_application(
    data: ApplicationCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Submit insurance application against a shipment."""
    user = _user(db, payload)
    return insurance_service.submit_application(db, user, data)


@router.get("/applications", response_model=list[ApplicationOut])
def list_applications(
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """List applications (customer sees own; officers see all)."""
    user = _user(db, payload)
    return insurance_service.list_applications(db, user)


@router.get("/applications/{app_id}", response_model=ApplicationOut)
def get_application(
    app_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Get specific application details."""
    user = _user(db, payload)
    return insurance_service.get_application(db, user, app_id)


@router.post("/applications/{app_id}/review", response_model=ApplicationOut)
def review_application(
    app_id: str,
    data: UnderwritingReviewIn,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Underwriting review: approve, reject, or request documents (Officers only)."""
    officer = _user(db, payload)
    return insurance_service.review_application(db, officer, app_id, data)
