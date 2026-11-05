"""
Schemas for insurance products, quotations, applications, and underwriting.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CoverageItem(BaseModel):
    id: Optional[str] = None
    coverage_name: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class ExclusionItem(BaseModel):
    id: Optional[str] = None
    exclusion_name: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: str
    product_code: str
    product_name: str
    description: str
    status: str
    min_insured_value: Decimal
    max_insured_value: Decimal
    base_rate: Decimal
    deductible_percentage: Decimal
    min_deductible: Decimal
    applicable_modes: str
    coverage_duration_days: int
    terms_and_conditions: str
    coverages: list[CoverageItem]
    exclusions: list[ExclusionItem]

    model_config = {"from_attributes": True}


class QuotationCreate(BaseModel):
    shipment_id: str
    product_id: str


class QuotationOut(BaseModel):
    id: str
    quotation_number: str
    customer_id: str
    shipment_id: str
    product_id: str
    product_name: Optional[str] = None
    insured_value: Decimal
    rate_applied: Decimal
    base_premium: Decimal
    additional_charges: Decimal
    tax_amount: Decimal
    total_premium: Decimal
    deductible_amount: Decimal
    currency: str
    status: str
    valid_until: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductComparisonItem(BaseModel):
    product: ProductOut
    quotation: QuotationOut
    is_eligible: bool
    eligibility_notes: list[str] = []


class ApplicationCreate(BaseModel):
    shipment_id: str
    product_id: str
    quotation_id: Optional[str] = None
    requested_insured_amount: Decimal = Field(gt=0)
    special_conditions: Optional[str] = None


class UnderwritingReviewIn(BaseModel):
    decision: Literal["approved", "rejected", "documents_required"]
    risk_score: Literal["low", "medium", "high"] = "low"
    risk_remarks: Optional[str] = None
    officer_remarks: Optional[str] = None


class UnderwritingReviewOut(BaseModel):
    id: str
    officer_id: str
    risk_score: str
    risk_remarks: Optional[str] = None
    decision: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationOut(BaseModel):
    id: str
    application_number: str
    customer_id: str
    shipment_id: str
    product_id: str
    product_name: Optional[str] = None
    quotation_id: Optional[str] = None
    requested_insured_amount: Decimal
    calculated_premium: Decimal
    status: str
    special_conditions: Optional[str] = None
    officer_remarks: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    underwriting_reviews: list[UnderwritingReviewOut] = []

    model_config = {"from_attributes": True}
