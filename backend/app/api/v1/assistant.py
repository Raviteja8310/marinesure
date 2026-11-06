"""Authenticated AI assistant and product recommendation endpoints."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.services import assistant_service
from app.services.rbac_service import require_permission

router = APIRouter(prefix="/ai/assistant", tags=["AI Assistant"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1000)


@router.post("/chat")
def chat(data: ChatRequest, user: User = Depends(require_permission("assistant.use")), db: Session = Depends(get_db)):
    """Answer a question using only products and the caller's own policies/claims, with citations."""
    return assistant_service.answer(db, user, data.message)


@router.get("/recommendations")
def recommendations(
    shipment_id: str = Query(...),
    user: User = Depends(require_permission("assistant.use")),
    db: Session = Depends(get_db),
):
    """Rank insurance products for a shipment the caller is allowed to view."""
    return assistant_service.recommend(db, user, shipment_id)
