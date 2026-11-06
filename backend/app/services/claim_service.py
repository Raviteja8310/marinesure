"""
Business logic and workflow service for Incidents, Claims, and Marine Surveyor inspections.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.models.claim_incident import Claim, Incident, SurveyReport
from app.models.payment_policy import Policy
from app.models.shipment import Shipment
from app.models.user import User, Role
from app.schemas.claim_incident import (
    ClaimCreate,
    ClaimReview,
    IncidentCreate,
    SurveyReportCreate,
)


class IncidentClaimService:

    # -------------------------------------------------------------
    # Number generators
    # -------------------------------------------------------------
    @staticmethod
    def generate_incident_number(db: Session) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"INC-{year}-"
        last = (
            db.query(Incident)
            .filter(Incident.incident_number.startswith(prefix))
            .order_by(desc(Incident.incident_number))
            .first()
        )
        if not last:
            return f"{prefix}000001"
        try:
            seq = int(last.incident_number.split("-")[-1]) + 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:06d}"

    @staticmethod
    def generate_claim_number(db: Session) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"CLM-{year}-"
        last = (
            db.query(Claim)
            .filter(Claim.claim_number.startswith(prefix))
            .order_by(desc(Claim.claim_number))
            .first()
        )
        if not last:
            return f"{prefix}000001"
        try:
            seq = int(last.claim_number.split("-")[-1]) + 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:06d}"

    @staticmethod
    def generate_report_number(db: Session) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"SRV-{year}-"
        last = (
            db.query(SurveyReport)
            .filter(SurveyReport.report_number.startswith(prefix))
            .order_by(desc(SurveyReport.report_number))
            .first()
        )
        if not last:
            return f"{prefix}000001"
        try:
            seq = int(last.report_number.split("-")[-1]) + 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:06d}"

    @staticmethod
    def generate_settlement_reference(db: Session) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"SET-{year}-"
        last = (
            db.query(Claim)
            .filter(Claim.settlement_reference.startswith(prefix))
            .order_by(desc(Claim.settlement_reference))
            .first()
        )
        if not last or not last.settlement_reference:
            return f"{prefix}000001"
        try:
            seq = int(last.settlement_reference.split("-")[-1]) + 1
        except Exception:
            seq = 1
        return f"{prefix}{seq:06d}"

    # -------------------------------------------------------------
    # Incidents
    # -------------------------------------------------------------
    @classmethod
    def report_incident(
        cls, db: Session, payload: IncidentCreate, current_user: User
    ) -> Incident:
        shipment = db.query(Shipment).filter(Shipment.id == payload.shipment_id).first()
        if not shipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shipment {payload.shipment_id} not found",
            )

        # Access check: customer who owns shipment, assigned shipping company, or officer/admin
        user_roles = current_user.role_names
        is_owner = shipment.customer_id == current_user.id
        is_carrier = shipment.shipping_company_id == current_user.id
        is_staff = any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin"))

        if not (is_owner or is_carrier or is_staff):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to report an incident for this shipment",
            )

        policy_id = payload.policy_id
        if not policy_id:
            # Look up active policy for this shipment if exists
            active_policy = (
                db.query(Policy)
                .filter(Policy.shipment_id == shipment.id, Policy.status == "active")
                .first()
            )
            if active_policy:
                policy_id = active_policy.id

        incident_number = cls.generate_incident_number(db)
        incident = Incident(
            incident_number=incident_number,
            shipment_id=shipment.id,
            policy_id=policy_id,
            reported_by_id=current_user.id,
            incident_date=payload.incident_date,
            incident_type=payload.incident_type,
            severity=payload.severity,
            location_name=payload.location_name,
            location_coordinates=payload.location_coordinates,
            description=payload.description,
            estimated_loss=payload.estimated_loss or Decimal("0"),
            status="reported",
            photos_documents=payload.photos_documents or [],
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)
        return incident

    @classmethod
    def list_incidents(cls, db: Session, current_user: User) -> List[Incident]:
        user_roles = current_user.role_names
        query = db.query(Incident).order_by(desc(Incident.created_at))

        if any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin", "surveyor")):
            return query.all()
        elif "shipping_company" in user_roles:
            return (
                query.join(Shipment, Incident.shipment_id == Shipment.id)
                .filter(Shipment.shipping_company_id == current_user.id)
                .all()
            )
        else:
            # Customer
            return query.filter(Incident.reported_by_id == current_user.id).all()

    # -------------------------------------------------------------
    # Claims
    # -------------------------------------------------------------
    @classmethod
    def submit_claim(cls, db: Session, payload: ClaimCreate, current_user: User) -> Claim:
        policy = db.query(Policy).filter(Policy.id == payload.policy_id).first()
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Policy {payload.policy_id} not found",
            )

        user_roles = current_user.role_names
        if policy.customer_id != current_user.id and not any(
            r in user_roles for r in ("insurance_officer", "admin")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only file claims against your own policies",
            )

        if policy.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot file claim against a policy with status '{policy.status}'. Policy must be 'active'.",
            )

        incident = db.query(Incident).filter(Incident.id == payload.incident_id).first()
        if not incident:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Incident {payload.incident_id} not found",
            )

        if payload.claim_amount > policy.insured_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Claim amount (₹{payload.claim_amount}) cannot exceed the policy "
                    f"insured limit (₹{policy.insured_amount})."
                ),
            )

        claim_number = cls.generate_claim_number(db)
        claim = Claim(
            claim_number=claim_number,
            policy_id=policy.id,
            incident_id=incident.id,
            claimant_id=current_user.id,
            claim_amount=payload.claim_amount,
            claim_type=payload.claim_type,
            claimant_notes=payload.claimant_notes,
            supporting_documents=payload.supporting_documents or [],
            status="submitted",
        )
        incident.status = "claim_filed"
        db.add(claim)
        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def list_claims(cls, db: Session, current_user: User) -> List[Claim]:
        user_roles = current_user.role_names
        query = (
            db.query(Claim)
            .options(joinedload(Claim.survey_reports))
            .order_by(desc(Claim.created_at))
        )

        if any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin")):
            return query.all()
        elif "surveyor" in user_roles:
            return query.filter(Claim.assigned_surveyor_id == current_user.id).all()
        else:
            return query.filter(Claim.claimant_id == current_user.id).all()

    @classmethod
    def get_claim(cls, db: Session, claim_id: str, current_user: User) -> Claim:
        claim = (
            db.query(Claim)
            .options(joinedload(Claim.survey_reports))
            .filter(Claim.id == claim_id)
            .first()
        )
        if not claim:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Claim not found",
            )

        user_roles = current_user.role_names
        is_claimant = claim.claimant_id == current_user.id
        is_assigned_surveyor = claim.assigned_surveyor_id == current_user.id
        is_officer = any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin"))

        if not (is_claimant or is_assigned_surveyor or is_officer):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this claim",
            )
        return claim

    @classmethod
    def assign_surveyor(
        cls, db: Session, claim_id: str, surveyor_id: str, current_user: User
    ) -> Claim:
        user_roles = current_user.role_names
        if not any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only insurance officers can assign marine surveyors",
            )

        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

        surveyor = (
            db.query(User)
            .join(User.roles)
            .filter(User.id == surveyor_id, Role.role_name == "surveyor")
            .first()
        )
        if not surveyor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user is not a registered Marine Surveyor",
            )

        claim.assigned_surveyor_id = surveyor.id
        claim.status = "surveyor_assigned"
        db.commit()
        db.refresh(claim)
        return claim

    # -------------------------------------------------------------
    # Surveyor Reports
    # -------------------------------------------------------------
    @classmethod
    def submit_survey_report(
        cls, db: Session, claim_id: str, payload: SurveyReportCreate, current_user: User
    ) -> SurveyReport:
        user_roles = current_user.role_names
        if "surveyor" not in user_roles and "admin" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only certified marine surveyors can submit inspection reports",
            )

        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

        if claim.assigned_surveyor_id and claim.assigned_surveyor_id != current_user.id and "admin" not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not the designated surveyor for this claim",
            )

        report_number = cls.generate_report_number(db)
        report = SurveyReport(
            report_number=report_number,
            claim_id=claim.id,
            surveyor_id=current_user.id,
            inspection_date=payload.inspection_date,
            inspection_location=payload.inspection_location,
            damage_assessment=payload.damage_assessment,
            cause_of_loss=payload.cause_of_loss,
            is_covered_peril=payload.is_covered_peril,
            estimated_loss_amount=payload.estimated_loss_amount,
            salvage_value=payload.salvage_value or Decimal("0"),
            recommended_settlement=payload.recommended_settlement,
            evidence_photos=payload.evidence_photos or [],
            status="submitted",
        )
        db.add(report)

        # Update claim status
        claim.status = "inspection_completed"
        db.commit()
        db.refresh(report)
        return report

    # -------------------------------------------------------------
    # Officer Review & Settlement
    # -------------------------------------------------------------
    @classmethod
    def review_claim(
        cls, db: Session, claim_id: str, payload: ClaimReview, current_user: User
    ) -> Claim:
        user_roles = current_user.role_names
        if not any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only insurance officers can review and adjust claims",
            )

        claim = (
            db.query(Claim)
            .options(joinedload(Claim.policy).joinedload(Policy.product))
            .filter(Claim.id == claim_id)
            .first()
        )
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

        claim.reviewed_by_id = current_user.id
        claim.officer_notes = payload.officer_notes

        if payload.status == "rejected":
            claim.status = "rejected"
            claim.rejection_reason = payload.rejection_reason or "Claim declined per policy exclusion/terms."
            claim.approved_amount = Decimal("0")
            claim.deductible_applied = Decimal("0")
            claim.net_payable = Decimal("0")
        elif payload.status == "approved":
            claim.status = "approved"
            approved_amount = payload.approved_amount if payload.approved_amount is not None else claim.claim_amount
            if approved_amount > claim.policy.insured_amount:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Approved amount cannot exceed policy limit of ₹{claim.policy.insured_amount}",
                )

            # Deductible calculation:
            product = claim.policy.product
            pct = Decimal(str(product.deductible_percentage or 5.0)) / Decimal(100)
            min_ded = Decimal(str(product.min_deductible or 5000.0))

            deductible = max(approved_amount * pct, min_ded)
            if deductible > approved_amount:
                deductible = approved_amount

            net_payable = max(Decimal("0"), approved_amount - deductible)

            claim.approved_amount = approved_amount
            claim.deductible_applied = deductible
            claim.net_payable = net_payable

        db.commit()
        db.refresh(claim)
        return claim

    @classmethod
    def settle_claim(
        cls, db: Session, claim_id: str, current_user: User, settlement_reference: Optional[str] = None
    ) -> Claim:
        user_roles = current_user.role_names
        if not any(r in user_roles for r in ("insurance_officer", "senior_officer", "admin")):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only insurance officers can execute claim settlement payouts",
            )

        claim = db.query(Claim).filter(Claim.id == claim_id).first()
        if not claim:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")

        if claim.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot settle a claim with status '{claim.status}'. Must be 'approved'.",
            )

        claim.status = "settled"
        claim.settled_at = datetime.now(timezone.utc)
        claim.settlement_reference = settlement_reference or cls.generate_settlement_reference(db)

        from app.services import finance_service

        finance_service.record_claim_settlement(db, claim, current_user, claim.settlement_reference)
        db.commit()
        db.refresh(claim)
        return claim
