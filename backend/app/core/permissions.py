"""
MarineSure 2.0 – Permission & RBAC Utilities

Role-based access control decorators and dependency injectors.
"""

from enum import Enum
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class UserRole(str, Enum):
    """Enumeration of platform roles."""

    CUSTOMER = "customer"
    SHIPPING_COMPANY = "shipping_company"
    SURVEYOR = "surveyor"
    AGENT = "agent"
    INSURANCE_OFFICER = "insurance_officer"
    SENIOR_OFFICER = "senior_officer"
    ADMIN = "admin"


async def get_current_user_payload(
    token: str = Depends(oauth2_scheme),
) -> dict:
    """Extract and validate the current user's JWT payload."""
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    return payload


def require_roles(*allowed_roles: UserRole):
    """Dependency that restricts an endpoint to specific roles."""

    async def _check(
        payload: dict = Depends(get_current_user_payload),
    ) -> dict:
        user_roles = payload.get("roles", [])
        if not any(role in user_roles for role in allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )
        return payload

    return _check
