"""
Shipment business rules.

Customers manage their own shipments until dispatch. Only the assigned
shipping company records milestones after that, and only forward.
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.shipment import (
    DOCUMENT_TYPES,
    EDITABLE_STATUSES,
    SHIPMENT_STATUSES,
    CargoItem,
    Shipment,
    ShipmentContainer,
    ShipmentDocument,
    ShipmentMilestone,
    ShipmentRoute,
)
from app.models.user import User

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def next_shipment_number(db: Session) -> str:
    count = db.query(Shipment).count() + 1
    return f"MS-{_now():%Y}-{count:06d}"


def _load(db: Session, shipment_id: str) -> Shipment:
    shipment = db.get(Shipment, shipment_id)
    if shipment is None or shipment.is_deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shipment not found")
    return shipment


def visible_query(db: Session, user: User):
    """Shipments the caller is allowed to see, newest first."""
    query = db.query(Shipment).filter(Shipment.is_deleted == 0)
    roles = set(user.role_names)
    if "admin" in roles or "insurance_officer" in roles or "senior_officer" in roles:
        return query
    if "shipping_company" in roles:
        return query.filter(Shipment.shipping_company_id == user.id)
    return query.filter(Shipment.customer_id == user.id)


def _can_view(user: User, shipment: Shipment) -> bool:
    roles = set(user.role_names)
    if roles & {"admin", "insurance_officer", "senior_officer"}:
        return True
    if shipment.customer_id == user.id:
        return True
    return shipment.shipping_company_id == user.id and "shipping_company" in roles


def require_view(db: Session, user: User, shipment_id: str) -> Shipment:
    shipment = _load(db, shipment_id)
    if not _can_view(user, shipment):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view this shipment")
    return shipment


def _require_owner(user: User, shipment: Shipment) -> None:
    if shipment.customer_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the owning customer can change this")


def _require_editable(shipment: Shipment) -> None:
    if shipment.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A shipment in status '{shipment.status}' can no longer be edited",
        )


def _check_shipping_company(db: Session, company_id: str | None) -> None:
    if not company_id:
        return
    company = db.get(User, company_id)
    if company is None or "shipping_company" not in company.role_names:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown shipping company")
    if company.status != "active":
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Shipping company is not active")


def _recompute_value(shipment: Shipment) -> None:
    shipment.declared_value = sum((item.value for item in shipment.cargo_items), Decimal("0"))


def to_dict(shipment: Shipment) -> dict:
    return {
        "id": shipment.id,
        "shipment_number": shipment.shipment_number,
        "customer_id": shipment.customer_id,
        "shipping_company_id": shipment.shipping_company_id,
        "status": shipment.status,
        "transport_mode": shipment.transport_mode,
        "origin_country": shipment.origin_country,
        "origin_location": shipment.origin_location,
        "destination_country": shipment.destination_country,
        "destination_location": shipment.destination_location,
        "departure_date": shipment.departure_date,
        "expected_arrival_date": shipment.expected_arrival_date,
        "currency": shipment.currency,
        "declared_value": shipment.declared_value,
        "packaging_details": shipment.packaging_details,
        "special_handling": shipment.special_handling,
        "route_details": shipment.route.route_details if shipment.route else None,
        "cargo_items": shipment.cargo_items,
        "containers": shipment.containers,
        "milestones": sorted(shipment.milestones, key=lambda m: m.event_time),
        "documents": shipment.documents,
        "created_at": shipment.created_at,
    }


def create_shipment(db: Session, user: User, data) -> Shipment:
    if "customer" not in user.role_names:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a customer can register a shipment")
    _check_shipping_company(db, data.shipping_company_id)
    if data.expected_arrival_date and data.departure_date:
        if data.expected_arrival_date < data.departure_date:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Arrival cannot precede departure"
            )

    shipment = Shipment(
        shipment_number=next_shipment_number(db),
        customer_id=user.id,
        shipping_company_id=data.shipping_company_id,
        transport_mode=data.transport_mode,
        origin_country=data.origin_country,
        origin_location=data.origin_location,
        destination_country=data.destination_country,
        destination_location=data.destination_location,
        departure_date=data.departure_date,
        expected_arrival_date=data.expected_arrival_date,
        currency=data.currency.upper(),
        packaging_details=data.packaging_details,
        special_handling=data.special_handling,
    )
    for item in data.cargo_items:
        shipment.cargo_items.append(CargoItem(**item.model_dump()))
    seen = set()
    for container in data.containers:
        if container.container_number in seen:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Duplicate container number")
        seen.add(container.container_number)
        shipment.containers.append(ShipmentContainer(**container.model_dump()))
    shipment.route = ShipmentRoute(
        origin=f"{data.origin_location}, {data.origin_country}",
        destination=f"{data.destination_location}, {data.destination_country}",
        route_details=data.route_details,
    )
    shipment.milestones.append(
        ShipmentMilestone(
            status="registered",
            location=data.origin_location,
            remarks="Shipment registered",
            event_time=_now(),
            recorded_by=user.id,
        )
    )
    _recompute_value(shipment)
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


def update_shipment(db: Session, user: User, shipment_id: str, data) -> Shipment:
    shipment = require_view(db, user, shipment_id)
    _require_owner(user, shipment)
    _require_editable(shipment)
    changes = data.model_dump(exclude_unset=True)
    _check_shipping_company(db, changes.get("shipping_company_id"))
    route_details = changes.pop("route_details", None)
    for field, value in changes.items():
        setattr(shipment, field, value)
    if route_details is not None and shipment.route:
        shipment.route.route_details = route_details
    db.commit()
    db.refresh(shipment)
    return shipment


def add_cargo(db: Session, user: User, shipment_id: str, data) -> Shipment:
    shipment = require_view(db, user, shipment_id)
    _require_owner(user, shipment)
    _require_editable(shipment)
    shipment.cargo_items.append(CargoItem(**data.model_dump()))
    _recompute_value(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


def add_container(db: Session, user: User, shipment_id: str, data) -> Shipment:
    shipment = require_view(db, user, shipment_id)
    _require_owner(user, shipment)
    _require_editable(shipment)
    numbers = {c.container_number for c in shipment.containers}
    if data.container_number in numbers:
        raise HTTPException(status.HTTP_409_CONFLICT, "Container number already on this shipment")
    shipment.containers.append(ShipmentContainer(**data.model_dump()))
    db.commit()
    db.refresh(shipment)
    return shipment


def record_milestone(db: Session, user: User, shipment_id: str, data) -> Shipment:
    shipment = require_view(db, user, shipment_id)
    assigned = shipment.shipping_company_id == user.id and "shipping_company" in user.role_names
    if not assigned:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Only the assigned shipping company can record milestones",
        )
    current = SHIPMENT_STATUSES.index(shipment.status)
    target = SHIPMENT_STATUSES.index(data.status)
    if target <= current:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Status can only move forward from '{shipment.status}'",
        )
    shipment.status = data.status
    shipment.milestones.append(
        ShipmentMilestone(
            status=data.status,
            location=data.location,
            remarks=data.remarks,
            event_time=data.event_time or _now(),
            recorded_by=user.id,
        )
    )
    db.commit()
    db.refresh(shipment)
    return shipment


def archive_shipment(db: Session, user: User, shipment_id: str) -> Shipment:
    shipment = require_view(db, user, shipment_id)
    _require_owner(user, shipment)
    if shipment.status not in ("delivered", "registered"):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only a delivered or unregistered shipment can be archived"
        )
    shipment.status = "archived"
    shipment.is_deleted = 1
    shipment.deleted_at = _now()
    db.commit()
    db.refresh(shipment)
    return shipment


async def store_document(
    db: Session, user: User, shipment_id: str, document_type: str, upload: UploadFile
) -> ShipmentDocument:
    import uuid
    from pathlib import Path

    shipment = require_view(db, user, shipment_id)
    if shipment.customer_id != user.id and shipment.shipping_company_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot upload to this shipment")
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unsupported document type")
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF, JPEG, PNG, and text files are accepted"
        )
    content = await upload.read()
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File must be under 10 MB")

    storage_key = f"{uuid.uuid4().hex}_{Path(upload.filename or 'document').name}"
    destination = Path("uploads") / "shipments" / shipment.id
    destination.mkdir(parents=True, exist_ok=True)
    (destination / storage_key).write_bytes(content)

    document = ShipmentDocument(
        shipment_id=shipment.id,
        document_type=document_type,
        original_filename=upload.filename or "document",
        storage_key=storage_key,
        content_type=upload.content_type,
        size_bytes=len(content),
        uploaded_by=user.id,
    )
    db.add(document)
    if shipment.status == "registered":
        shipment.status = "documents_submitted"
    db.commit()
    db.refresh(document)
    return document
