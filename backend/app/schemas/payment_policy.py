"""
Schemas for payment orders, policy issuance, endorsements, and renewals.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class PaymentOrderCreate(BaseModel):
    application_id: str


class PaymentOrderOut(BaseModel):
    id: str
    order_reference: str
    customer_id: str
    application_id: str
    gateway_order_id: Optional[str]
    amount: Decimal
    currency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentVerifyRequest(BaseModel):
    gateway_payment_id: str = Field(min_length=5)
    gateway_signature: Optional[str] = None


class EndorsementCreate(BaseModel):
    requested_changes: str = Field(min_length=5, max_length=1000)
    reason: str = Field(min_length=5, max_length=500)


class CancellationCreate(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class PolicyOut(BaseModel):
    id: str
    policy_number: str
    application_id: str
    customer_id: str
    shipment_id: str
    product_id: str
    insured_amount: Decimal
    premium_paid: Decimal
    deductible_amount: Decimal
    effective_date: date
    expiry_date: date
    status: str
    pdf_storage_key: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
