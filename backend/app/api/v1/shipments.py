"""Shipment registration, documents, and tracking milestones."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.permissions import get_current_user_payload
from app.database.connection import get_db
from app.models.shipment import Shipment
from app.models.user import User
from app.schemas.shipment import (
    CargoItemIn,
    ContainerIn,
    MilestoneCreate,
    ShipmentCreate,
    ShipmentOut,
    ShipmentUpdate,
)
from app.services import shipment_service

router = APIRouter(prefix="/shipments", tags=["Shipments"])


def _user(db: Session, payload: dict) -> User:
    user = db.get(User, payload["sub"])
    if user is None or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is not active")
    return user


@router.get("", response_model=list[ShipmentOut])
def list_shipments(
    payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)
):
    user = _user(db, payload)
    shipments = (
        shipment_service.visible_query(db, user).order_by(Shipment.created_at.desc()).all()
    )
    return [shipment_service.to_dict(s) for s in shipments]


@router.post("", response_model=ShipmentOut, status_code=201)
def create_shipment(
    data: ShipmentCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.create_shipment(db, _user(db, payload), data)
    return shipment_service.to_dict(shipment)


@router.get("/{shipment_id}", response_model=ShipmentOut)
def get_shipment(
    shipment_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.require_view(db, _user(db, payload), shipment_id)
    return shipment_service.to_dict(shipment)


@router.patch("/{shipment_id}", response_model=ShipmentOut)
def update_shipment(
    shipment_id: str,
    data: ShipmentUpdate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.update_shipment(db, _user(db, payload), shipment_id, data)
    return shipment_service.to_dict(shipment)


@router.post("/{shipment_id}/cargo", response_model=ShipmentOut, status_code=201)
def add_cargo(
    shipment_id: str,
    data: CargoItemIn,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.add_cargo(db, _user(db, payload), shipment_id, data)
    return shipment_service.to_dict(shipment)


@router.post("/{shipment_id}/containers", response_model=ShipmentOut, status_code=201)
def add_container(
    shipment_id: str,
    data: ContainerIn,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.add_container(db, _user(db, payload), shipment_id, data)
    return shipment_service.to_dict(shipment)


@router.post("/{shipment_id}/milestones", response_model=ShipmentOut, status_code=201)
def record_milestone(
    shipment_id: str,
    data: MilestoneCreate,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.record_milestone(db, _user(db, payload), shipment_id, data)
    return shipment_service.to_dict(shipment)


@router.post("/{shipment_id}/documents", status_code=201)
async def upload_document(
    shipment_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    document = await shipment_service.store_document(
        db, _user(db, payload), shipment_id, document_type, file
    )
    return {
        "id": document.id,
        "document_type": document.document_type,
        "original_filename": document.original_filename,
        "size_bytes": document.size_bytes,
    }


@router.post("/{shipment_id}/archive", response_model=ShipmentOut)
def archive_shipment(
    shipment_id: str,
    payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    shipment = shipment_service.archive_shipment(db, _user(db, payload), shipment_id)
    return shipment_service.to_dict(shipment)
