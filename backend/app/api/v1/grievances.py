"""Customer grievances: create, list, comment, attach evidence, and resolve."""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.claim_incident import Claim
from app.models.payment_policy import Policy
from app.models.service_ops import (
    GRIEVANCE_CATEGORIES,
    GRIEVANCE_PRIORITIES,
    GRIEVANCE_TRANSITIONS,
    Grievance,
    GrievanceAttachment,
    GrievanceComment,
)
from app.models.user import User
from app.services.agent_service import AuditService, NotificationService
from app.services.rbac_service import has_permission, load_active_user, require_permission

router = APIRouter(tags=["Grievances"])

UPLOAD_ROOT = Path("uploads") / "grievances"
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png", "text/plain"}
MAX_BYTES = 10 * 1024 * 1024


class GrievanceCreate(BaseModel):
    category: Literal[GRIEVANCE_CATEGORIES]  # type: ignore[valid-type]
    priority: Literal[GRIEVANCE_PRIORITIES] = "medium"  # type: ignore[valid-type]
    subject: str = Field(min_length=5, max_length=200)
    description: str = Field(min_length=20, max_length=5000)
    related_claim_id: Optional[str] = None
    related_policy_id: Optional[str] = None


class GrievanceUpdate(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved", "rejected", "closed"]] = None
    priority: Optional[Literal[GRIEVANCE_PRIORITIES]] = None  # type: ignore[valid-type]
    assigned_to_id: Optional[str] = None
    resolution: Optional[str] = Field(default=None, min_length=5, max_length=5000)


class CommentCreate(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    is_internal: bool = False


class CommentOut(BaseModel):
    id: str
    author_id: Optional[str]
    author_name: Optional[str]
    message: str
    is_internal: bool
    created_at: datetime


class AttachmentOut(BaseModel):
    id: str
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime
    model_config = {"from_attributes": True}


class GrievanceOut(BaseModel):
    id: str
    grievance_number: str
    customer_id: str
    customer_name: Optional[str]
    category: str
    priority: str
    subject: str
    description: str
    related_claim_id: Optional[str]
    related_policy_id: Optional[str]
    status: str
    assigned_to_id: Optional[str]
    assigned_to_name: Optional[str]
    resolution: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    comments: list[CommentOut]
    attachments: list[AttachmentOut]


def _is_handler(db: Session, user: User) -> bool:
    return has_permission(db, user, "grievances.manage")


def _out(g: Grievance, staff: bool) -> GrievanceOut:
    comments = [
        CommentOut(id=c.id, author_id=c.author_id, author_name=c.author.name if c.author else None,
                   message=c.message, is_internal=c.is_internal, created_at=c.created_at)
        for c in g.comments if staff or not c.is_internal
    ]
    return GrievanceOut(
        id=g.id, grievance_number=g.grievance_number, customer_id=g.customer_id,
        customer_name=g.customer.name if g.customer else None, category=g.category, priority=g.priority,
        subject=g.subject, description=g.description, related_claim_id=g.related_claim_id,
        related_policy_id=g.related_policy_id, status=g.status, assigned_to_id=g.assigned_to_id,
        assigned_to_name=g.assigned_to.name if g.assigned_to else None, resolution=g.resolution,
        resolved_at=g.resolved_at, created_at=g.created_at, updated_at=g.updated_at,
        comments=comments, attachments=[AttachmentOut.model_validate(a) for a in g.attachments],
    )


def _load(db: Session, user: User, grievance_id: str) -> tuple[Grievance, bool]:
    g = db.get(Grievance, grievance_id)
    if g is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grievance not found")
    staff = _is_handler(db, user)
    if not staff and g.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Access denied")
    return g, staff


@router.post("/grievances", response_model=GrievanceOut, status_code=201)
def create_grievance(data: GrievanceCreate, user: User = Depends(require_permission("grievances.create")), db: Session = Depends(get_db)):
    if data.related_claim_id:
        claim = db.get(Claim, data.related_claim_id)
        if claim is None or claim.claimant_id != user.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Related claim not found on your account")
    if data.related_policy_id:
        policy = db.get(Policy, data.related_policy_id)
        if policy is None or policy.customer_id != user.id:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Related policy not found on your account")
    g = Grievance(
        grievance_number=f"GRV-{datetime.now(timezone.utc):%Y}-{db.query(Grievance).count() + 1:06d}",
        customer_id=user.id, status="open", **data.model_dump(),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    AuditService.record(db, "GRIEVANCE_CREATED", "grievance", g.id, user.id, {"category": g.category})
    return _out(g, staff=False)


@router.get("/grievances", response_model=list[GrievanceOut])
def list_grievances(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    user = load_active_user(db, payload)
    staff = _is_handler(db, user)
    q = db.query(Grievance)
    if not staff:
        q = q.filter(Grievance.customer_id == user.id)
    if status_filter:
        q = q.filter(Grievance.status == status_filter)
    return [_out(g, staff) for g in q.order_by(Grievance.created_at.desc()).all()]


@router.get("/grievances/{grievance_id}", response_model=GrievanceOut)
def get_grievance(grievance_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    g, staff = _load(db, load_active_user(db, payload), grievance_id)
    return _out(g, staff)


@router.patch("/grievances/{grievance_id}", response_model=GrievanceOut)
def update_grievance(grievance_id: str, data: GrievanceUpdate, actor: User = Depends(require_permission("grievances.manage")), db: Session = Depends(get_db)):
    g, _ = _load(db, actor, grievance_id)
    changes = data.model_dump(exclude_unset=True)
    if "assigned_to_id" in changes and changes["assigned_to_id"]:
        assignee = db.get(User, changes["assigned_to_id"])
        if assignee is None or not has_permission(db, assignee, "grievances.manage"):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Assignee must be staff who can handle grievances")
        g.assigned_to_id = assignee.id
        if g.status == "open" and "status" not in changes:
            changes["status"] = "in_progress"
    if "priority" in changes and changes["priority"]:
        g.priority = changes["priority"]
    if "resolution" in changes:
        g.resolution = changes["resolution"]
    new_status = changes.get("status")
    if new_status and new_status != g.status:
        if new_status not in GRIEVANCE_TRANSITIONS[g.status]:
            raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot move grievance from '{g.status}' to '{new_status}'")
        if new_status in ("resolved", "rejected") and not g.resolution:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A resolution note is required to resolve or reject")
        g.status = new_status
        g.resolved_at = datetime.now(timezone.utc) if new_status in ("resolved", "rejected") else g.resolved_at
    db.commit()
    db.refresh(g)
    if new_status:
        NotificationService.send(db, g.customer_id, f"Grievance {g.grievance_number} updated",
                                 f"Status is now '{g.status.replace('_', ' ')}'.", "info", "/customer/grievances")
    AuditService.record(db, "GRIEVANCE_UPDATED", "grievance", g.id, actor.id, {k: v for k, v in changes.items() if k != "resolution"})
    return _out(g, staff=True)


@router.post("/grievances/{grievance_id}/comments", response_model=GrievanceOut, status_code=201)
def add_comment(grievance_id: str, data: CommentCreate, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    g, staff = _load(db, user, grievance_id)
    if g.status == "closed":
        raise HTTPException(status.HTTP_409_CONFLICT, "Closed grievances cannot receive comments")
    if data.is_internal and not staff:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only staff can post internal notes")
    db.add(GrievanceComment(grievance_id=g.id, author_id=user.id, message=data.message, is_internal=data.is_internal))
    if not staff and g.status in ("resolved", "rejected"):
        g.status = "in_progress"  # customer reply reopens the case
    db.commit()
    db.refresh(g)
    if staff and not data.is_internal:
        NotificationService.send(db, g.customer_id, f"New reply on {g.grievance_number}", data.message[:200], "info", "/customer/grievances")
    return _out(g, staff)


@router.post("/grievances/{grievance_id}/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(grievance_id: str, file: UploadFile = File(...), payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = load_active_user(db, payload)
    g, _ = _load(db, user, grievance_id)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF, JPEG, PNG, and text files are accepted")
    content = await file.read()
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File must be under 10 MB")
    key = f"{uuid.uuid4().hex}_{Path(file.filename or 'attachment').name}"
    dest = UPLOAD_ROOT / g.id
    dest.mkdir(parents=True, exist_ok=True)
    (dest / key).write_bytes(content)
    att = GrievanceAttachment(grievance_id=g.id, original_filename=file.filename or "attachment", storage_key=key,
                              content_type=file.content_type, size_bytes=len(content), uploaded_by_id=user.id)
    db.add(att)
    db.commit()
    db.refresh(att)
    return att


@router.get("/grievances/{grievance_id}/attachments/{attachment_id}")
def download_attachment(grievance_id: str, attachment_id: str, payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    g, _ = _load(db, load_active_user(db, payload), grievance_id)
    att = next((a for a in g.attachments if a.id == attachment_id), None)
    path = UPLOAD_ROOT / g.id / att.storage_key if att else None
    if att is None or not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return FileResponse(path, media_type=att.content_type, filename=att.original_filename)
