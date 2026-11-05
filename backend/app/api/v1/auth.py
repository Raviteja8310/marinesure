"""Authentication endpoints: register, verify, login, refresh, reset."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.connection import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _dev(token: str | None) -> str | None:
    """Expose the one-time token only while developing, since SMTP is not wired yet."""
    return token if settings.APP_ENV == "development" else None


@router.post("/register", response_model=MessageResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user, token = auth_service.register_user(db, data)
    return MessageResponse(
        message=f"Account created for {user.email}. Verify your email to sign in.",
        dev_token=_dev(token),
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    user = auth_service.verify_email(db, data.token)
    return MessageResponse(message=f"{user.email} is verified. You can sign in.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = auth_service.resend_verification(db, data.email)
    return MessageResponse(
        message="If the account exists and is unverified, a new link has been sent.",
        dev_token=_dev(token),
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return auth_service.authenticate(db, data.email, data.password, request)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    return auth_service.rotate_refresh(db, data.refresh_token, request)


@router.post("/logout", response_model=MessageResponse)
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.logout(db, data.refresh_token)
    return MessageResponse(message="Signed out")


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = auth_service.request_password_reset(db, data.email)
    return MessageResponse(
        message="If the account exists, password reset instructions have been sent.",
        dev_token=_dev(token),
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password(db, data.token, data.new_password)
    return MessageResponse(message="Password updated. Sign in with your new password.")
