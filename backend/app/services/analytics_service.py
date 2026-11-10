"""
MarineSure – Portfolio Analytics, Loss Ratio, and Actuarial Financial Service.
"""

from decimal import Decimal
from typing import Any, Dict, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.claim_incident import Claim, Incident
from app.models.insurance import InsuranceApplication, InsuranceProduct
from app.models.payment_policy import Policy
from app.models.shipment import CargoItem, Shipment
from app.models.user import User


class AnalyticsService:

    @classmethod
    def get_dashboard_kpis(cls, db: Session) -> Dict[str, Any]:
        """Aggregate key operational, underwriting, and claims financial KPIs."""
        # 1. Policies & GWP
        active_policies = db.query(Policy).filter(Policy.status == "active").all()
        active_policy_count = len(active_policies)

        all_policies = db.query(Policy).all()
        total_gwp = sum((p.premium_paid for p in all_policies), Decimal("0.00"))
        total_insured_risk = sum((p.insured_amount for p in active_policies), Decimal("0.00"))

        # 2. Claims financial metrics
        all_claims = db.query(Claim).all()
        total_claims_count = len(all_claims)

        settled_claims = [c for c in all_claims if c.status == "settled"]
        total_claims_paid = sum((c.net_payable or Decimal("0.00") for c in settled_claims), Decimal("0.00"))

        pending_claims = [c for c in all_claims if c.status in ("submitted", "surveyor_assigned", "inspection_completed", "approved")]
        outstanding_reserve = sum((c.claim_amount or Decimal("0.00") for c in pending_claims), Decimal("0.00"))

        # 3. Loss Ratio
        loss_ratio = Decimal("0.00")
        if total_gwp > 0:
            loss_ratio = round((total_claims_paid / total_gwp) * Decimal("100.0"), 2)

        if loss_ratio <= 50:
            health_status = "Optimal Profitability"
            health_color = "emerald"
        elif loss_ratio <= 75:
            health_status = "Moderate Loss Ratio"
            health_color = "amber"
        else:
            health_status = "High Claims Pressure"
            health_color = "rose"

        # 4. Underwriting pipeline
        pending_applications = (
            db.query(InsuranceApplication)
            .filter(InsuranceApplication.status.in_(["submitted", "under_review", "documents_required"]))
            .count()
        )
        total_applications = db.query(InsuranceApplication).count()
        approved_applications = (
            db.query(InsuranceApplication).filter(InsuranceApplication.status == "approved").count()
        )
        approval_rate = (
            round((approved_applications / total_applications) * 100, 1)
            if total_applications > 0
            else 0.0
        )

        # 5. Incidents & Shipments
        total_shipments = db.query(Shipment).filter(Shipment.is_deleted == 0).count()
        total_incidents = db.query(Incident).count()

        return {
            "financials": {
                "gross_written_premium": float(total_gwp),
                "total_claims_paid": float(total_claims_paid),
                "outstanding_claims_reserve": float(outstanding_reserve),
                "total_insured_risk_exposure": float(total_insured_risk),
                "portfolio_loss_ratio_pct": float(loss_ratio),
                "portfolio_health": {
                    "status": health_status,
                    "color": health_color,
                },
            },
            "operations": {
                "active_policies_count": active_policy_count,
                "total_policies_issued": len(all_policies),
                "total_claims_filed": total_claims_count,
                "pending_claims_count": len(pending_claims),
                "pending_applications_count": pending_applications,
                "underwriting_approval_rate_pct": approval_rate,
                "total_registered_shipments": total_shipments,
                "total_reported_incidents": total_incidents,
            },
        }

    @classmethod
    def get_portfolio_exposure(cls, db: Session) -> Dict[str, Any]:
        """Distribution of risk exposure across transport modes, cargo categories, and products."""
        # 1. Transport Mode Exposure
        mode_counts = (
            db.query(
                Shipment.transport_mode,
                func.count(Policy.id).label("policy_count"),
                func.sum(Policy.insured_amount).label("total_exposure"),
                func.sum(Policy.premium_paid).label("total_premium"),
            )
            .join(Policy, Shipment.id == Policy.shipment_id)
            .filter(Policy.status == "active")
            .group_by(Shipment.transport_mode)
            .all()
        )

        transport_exposure = [
            {
                "mode": row.transport_mode or "sea",
                "policies": int(row.policy_count),
                "exposure": float(row.total_exposure or 0),
                "premium": float(row.total_premium or 0),
            }
            for row in mode_counts
        ]

        # 2. Cargo Category Exposure
        cargo_counts = (
            db.query(
                CargoItem.category,
                func.count(Policy.id).label("policy_count"),
                func.sum(Policy.insured_amount).label("total_exposure"),
            )
            .join(Shipment, CargoItem.shipment_id == Shipment.id)
            .join(Policy, Shipment.id == Policy.shipment_id)
            .filter(Policy.status == "active")
            .group_by(CargoItem.category)
            .all()
        )

        cargo_exposure = [
            {
                "category": row.category or "general",
                "policies": int(row.policy_count),
                "exposure": float(row.total_exposure or 0),
            }
            for row in cargo_counts
        ]

        # 3. Product Performance Breakdown
        products = db.query(InsuranceProduct).filter(InsuranceProduct.is_deleted == 0).all()
        product_breakdown = []
        for pr in products:
            pols = db.query(Policy).filter(Policy.product_id == pr.id).all()
            p_gwp = sum((p.premium_paid for p in pols), Decimal("0"))
            pol_ids = [p.id for p in pols]

            p_claims = (
                db.query(Claim)
                .filter(Claim.policy_id.in_(pol_ids), Claim.status == "settled")
                .all()
                if pol_ids
                else []
            )
            p_paid = sum((c.net_payable or Decimal("0") for c in p_claims), Decimal("0"))
            p_loss_ratio = round((p_paid / p_gwp * Decimal("100.0")), 2) if p_gwp > 0 else Decimal("0.0")

            product_breakdown.append({
                "product_code": pr.product_code,
                "product_name": pr.product_name,
                "active_policies": len([p for p in pols if p.status == "active"]),
                "gwp": float(p_gwp),
                "claims_paid": float(p_paid),
                "loss_ratio_pct": float(p_loss_ratio),
            })

        # 4. Top Destination Exposure Countries
        dest_counts = (
            db.query(
                Shipment.destination_country,
                func.count(Policy.id).label("policy_count"),
                func.sum(Policy.insured_amount).label("total_exposure"),
            )
            .join(Policy, Shipment.id == Policy.shipment_id)
            .filter(Policy.status == "active")
            .group_by(Shipment.destination_country)
            .order_by(func.sum(Policy.insured_amount).desc())
            .limit(8)
            .all()
        )

        destination_exposure = [
            {
                "country": row.destination_country or "Unknown",
                "policies": int(row.policy_count),
                "exposure": float(row.total_exposure or 0),
            }
            for row in dest_counts
        ]

        return {
            "transport_modes": transport_exposure,
            "cargo_categories": cargo_exposure,
            "product_performance": product_breakdown,
            "top_destinations": destination_exposure,
        }

    @classmethod
    def get_monthly_trends(cls, db: Session, months: int = 6) -> Dict[str, Any]:
        """Premium written vs. claims settled per calendar month, from real records.

        Premium is grouped by policy issue date; claims by settlement date. Months
        with no activity are reported as zero rather than omitted.
        """
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        keys = []
        y, m = now.year, now.month
        for _ in range(months):
            keys.append((y, m))
            y, m = (y - 1, 12) if m == 1 else (y, m - 1)
        keys.reverse()
        buckets = {k: {"gwp": Decimal("0"), "claims": Decimal("0"), "policies": 0, "settled_claims": 0} for k in keys}

        for p in db.query(Policy).all():
            k = (p.created_at.year, p.created_at.month) if p.created_at else None
            if k in buckets:
                buckets[k]["gwp"] += p.premium_paid or Decimal("0")
                buckets[k]["policies"] += 1
        for c in db.query(Claim).filter(Claim.status == "settled", Claim.settled_at.isnot(None)).all():
            k = (c.settled_at.year, c.settled_at.month)
            if k in buckets:
                buckets[k]["claims"] += c.net_payable or Decimal("0")
                buckets[k]["settled_claims"] += 1

        months_data = [
            {
                "month": datetime(k[0], k[1], 1).strftime("%b %Y") + (" (MTD)" if k == (now.year, now.month) else ""),
                "gwp": float(v["gwp"]),
                "claims": float(v["claims"]),
                "policies_issued": v["policies"],
                "claims_settled": v["settled_claims"],
            }
            for k, v in buckets.items()
        ]
        return {"monthly_financial_history": months_data, "source": "policies and settled claims"}
