"""Request and response schemas for authentication and profiles."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from app.models.user import SELF_REGISTER_ROLES

RegisterRole = Literal["customer", "shipping_company", "surveyor", "agent"]
CustomerType = Literal["importer", "exporter", "both"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: RegisterRole
    phone: Optional[str] = Field(default=None, max_length=30)
    # Customer
    customer_type: CustomerType = "importer"
    company_name: Optional[str] = Field(default=None, max_length=200)
    country: Optional[str] = Field(default=None, max_length=80)
    # Shipping company / agent
    registration_number: Optional[str] = Field(default=None, max_length=80)
    agency_name: Optional[str] = Field(default=None, max_length=200)
    license_number: Optional[str] = Field(default=None, max_length=80)
    # Surveyor
    qualification: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class RefreshRequest(BaseModel):
    refresh_token: str


class MessageResponse(BaseModel):
    message: str
    # Returned only in development so the flow can be demonstrated without SMTP.
    dev_token: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=10)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    phone: Optional[str] = Field(default=None, max_length=30)
    company_name: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = None
    country: Optional[str] = Field(default=None, max_length=80)
    customer_type: Optional[CustomerType] = None
    qualification: Optional[str] = Field(default=None, max_length=200)


class RoleAssignRequest(BaseModel):
    role: Literal[
        "customer",
        "shipping_company",
        "surveyor",
        "agent",
        "insurance_officer",
        "senior_officer",
        "admin",
    ]
    employee_code: Optional[str] = Field(default=None, max_length=40)
    department: Optional[str] = Field(default=None, max_length=80)


class StatusChangeRequest(BaseModel):
    status: Literal["active", "suspended"]


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    status: str
    email_verified: bool
    roles: list[str]
    created_at: datetime
    last_login_at: Optional[datetime] = None
    profile: dict = {}

    model_config = {"from_attributes": True}


class LoginEvent(BaseModel):
    email: str
    status: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    login_time: datetime

    model_config = {"from_attributes": True}


TokenResponse.model_rebuild()
