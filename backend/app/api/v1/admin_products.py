"""Admin product catalogue management: create, update, activate, deactivate."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.insurance import InsuranceApplication, InsuranceProduct, ProductCoverage, ProductExclusion
from app.models.user import User
from app.schemas.insurance import ProductOut
from app.services import insurance_service
from app.services.agent_service import AuditService
from app.services.rbac_service import require_permission

router = APIRouter(prefix="/admin/insurance-products", tags=["Admin: Product Catalogue"])

VALID_MODES = {"sea", "air", "road", "rail", "multimodal"}


class NamedItem(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: Optional[str] = Field(default=None, max_length=2000)


class ProductFields(BaseModel):
    product_name: Optional[str] = Field(default=None, min_length=3, max_length=150)
    description: Optional[str] = Field(default=None, min_length=10)
    min_insured_value: Optional[Decimal] = Field(default=None, gt=0, max_digits=15, decimal_places=2)
    max_insured_value: Optional[Decimal] = Field(default=None, gt=0, max_digits=15, decimal_places=2)
    base_rate: Optional[Decimal] = Field(default=None, gt=0, le=Decimal("0.2"), max_digits=6, decimal_places=4)
    deductible_percentage: Optional[Decimal] = Field(default=None, ge=0, le=50, max_digits=5, decimal_places=2)
    min_deductible: Optional[Decimal] = Field(default=None, ge=0, max_digits=15, decimal_places=2)
    applicable_modes: Optional[list[str]] = Field(default=None, min_length=1)
    coverage_duration_days: Optional[int] = Field(default=None, ge=1, le=730)
    terms_and_conditions: Optional[str] = Field(default=None, min_length=10)
    coverages: Optional[list[NamedItem]] = None
    exclusions: Optional[list[NamedItem]] = None

    @model_validator(mode="after")
    def _modes(self):
        if self.applicable_modes is not None:
            bad = set(self.applicable_modes) - VALID_MODES
            if bad:
                raise ValueError(f"Unknown transport modes: {', '.join(sorted(bad))}")
        if self.min_insured_value is not None and self.max_insured_value is not None:
            if self.min_insured_value >= self.max_insured_value:
                raise ValueError("min_insured_value must be less than max_insured_value")
        return self


class ProductCreate(ProductFields):
    product_code: str = Field(pattern=r"^[A-Z][A-Z0-9_]{1,19}$")
    product_name: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=10)
    min_insured_value: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    max_insured_value: Decimal = Field(gt=0, max_digits=15, decimal_places=2)
    base_rate: Decimal = Field(gt=0, le=Decimal("0.2"), max_digits=6, decimal_places=4)
    deductible_percentage: Decimal = Field(ge=0, le=50, max_digits=5, decimal_places=2)
    min_deductible: Decimal = Field(ge=0, max_digits=15, decimal_places=2)
    applicable_modes: list[str] = Field(min_length=1)
    coverage_duration_days: int = Field(ge=1, le=730)
    terms_and_conditions: str = Field(min_length=10)
    coverages: list[NamedItem] = Field(min_length=1)
    exclusions: list[NamedItem] = Field(default_factory=list)


def _apply(product: InsuranceProduct, data: ProductFields) -> dict:
    changes = data.model_dump(exclude_unset=True, exclude={"coverages", "exclusions"})
    if "applicable_modes" in changes:
        changes["applicable_modes"] = ",".join(sorted(set(changes["applicable_modes"])))
    for key, value in changes.items():
        setattr(product, key, value)
    if product.min_insured_value >= product.max_insured_value:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "min_insured_value must be less than max_insured_value")
    if data.coverages is not None:
        if not data.coverages:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A product needs at least one coverage")
        product.coverages = [ProductCoverage(coverage_name=c.name, description=c.description) for c in data.coverages]
        changes["coverages"] = [c.name for c in data.coverages]
    if data.exclusions is not None:
        product.exclusions = [ProductExclusion(exclusion_name=e.name, description=e.description) for e in data.exclusions]
        changes["exclusions"] = [e.name for e in data.exclusions]
    return {k: str(v) if isinstance(v, Decimal) else v for k, v in changes.items()}


def _get(db: Session, product_id: str) -> InsuranceProduct:
    return insurance_service.get_product(db, product_id)


@router.get("", response_model=list[ProductOut])
def list_all_products(_: User = Depends(require_permission("products.manage", "products.view")), db: Session = Depends(get_db)):
    """Every product including inactive ones."""
    return insurance_service.list_products(db, include_inactive=True)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(data: ProductCreate, actor: User = Depends(require_permission("products.manage")), db: Session = Depends(get_db)):
    if db.query(InsuranceProduct).filter(InsuranceProduct.product_code == data.product_code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A product with this code already exists")
    product = InsuranceProduct(product_code=data.product_code, status="inactive",
                               min_insured_value=data.min_insured_value, max_insured_value=data.max_insured_value)
    changes = _apply(product, data)
    db.add(product)
    db.commit()
    db.refresh(product)
    AuditService.record(db, "PRODUCT_CREATED", "insurance_product", product.id, actor.id, {"product_code": product.product_code, **changes})
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: str, data: ProductFields, actor: User = Depends(require_permission("products.manage")), db: Session = Depends(get_db)):
    product = _get(db, product_id)
    changes = _apply(product, data)
    db.commit()
    db.refresh(product)
    AuditService.record(db, "PRODUCT_UPDATED", "insurance_product", product.id, actor.id, changes)
    return product


def _set_status(db: Session, product: InsuranceProduct, new_status: str, actor: User) -> InsuranceProduct:
    if product.status == new_status:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Product is already {new_status}")
    product.status = new_status
    db.commit()
    db.refresh(product)
    AuditService.record(db, f"PRODUCT_{new_status.upper()}", "insurance_product", product.id, actor.id, {})
    return product


@router.post("/{product_id}/activate", response_model=ProductOut)
def activate_product(product_id: str, actor: User = Depends(require_permission("products.manage")), db: Session = Depends(get_db)):
    product = _get(db, product_id)
    if not product.coverages:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add at least one coverage before activating")
    return _set_status(db, product, "active", actor)


@router.post("/{product_id}/deactivate", response_model=ProductOut)
def deactivate_product(product_id: str, actor: User = Depends(require_permission("products.manage")), db: Session = Depends(get_db)):
    """Stop offering a product. Existing policies remain valid."""
    return _set_status(db, _get(db, product_id), "inactive", actor)


@router.delete("/{product_id}", status_code=204)
def retire_product(product_id: str, actor: User = Depends(require_permission("products.manage")), db: Session = Depends(get_db)):
    """Soft-delete a product that has never been applied for."""
    product = _get(db, product_id)
    if db.query(InsuranceApplication).filter(InsuranceApplication.product_id == product.id).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Product has applications; deactivate it instead")
    product.is_deleted = 1
    product.deleted_at = datetime.now(timezone.utc)
    product.status = "inactive"
    db.commit()
    AuditService.record(db, "PRODUCT_RETIRED", "insurance_product", product.id, actor.id, {})
