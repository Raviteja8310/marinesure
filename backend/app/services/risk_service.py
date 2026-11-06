"""
MarineSure 2.0 – Algorithmic Marine Underwriting Risk Assessment Engine.

Computes multi-factorial marine transit risk scores (0-100), risk tiers
(LOW, MODERATE, HIGH, CRITICAL), and recommends underwriting clauses,
warranties, and deductible adjustments.
"""

from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.insurance import InsuranceApplication
from app.models.shipment import Shipment

# High risk geographical chokepoints and maritime corridors
HIGH_RISK_REGIONS = {
    "red sea": {"score": 25, "reason": "War/Conflict and missile threat in Bab-el-Mandeb corridor"},
    "bab-el-mandeb": {"score": 25, "reason": "High-risk conflict transit zone"},
    "gulf of aden": {"score": 22, "reason": "Maritime piracy and armed robbery risk zone"},
    "strait of malacca": {"score": 15, "reason": "Extremely congested waters; collision and petty piracy hazard"},
    "strait of hormuz": {"score": 20, "reason": "Geopolitical tension and vessel interdiction risk"},
    "cape of good hope": {"score": 15, "reason": "Severe rogue waves and winter storm exposure"},
    "south china sea": {"score": 12, "reason": "Typhoon belt and territorial navigation disputes"},
    "black sea": {"score": 28, "reason": "Active war risk and sea mine exclusion zone"},
    "somalia": {"score": 25, "reason": "Listed piracy exclusion area"},
    "yemen": {"score": 25, "reason": "Listed war risk exclusion area"},
}

CARGO_RISK_FACTORS = {
    "hazardous": {"points": 25, "hazard": "Chemical reactivity, leakage, combustion, or environmental contamination"},
    "perishable": {"points": 22, "hazard": "Temperature sensitivity, shelf-life decay, spoilage upon power failure"},
    "fragile": {"points": 18, "hazard": "Shock/vibration vulnerability, rough handling breakages"},
    "electronics": {"points": 16, "hazard": "High target for pilferage/theft and electrostatic/water sensitivity"},
    "machinery": {"points": 12, "hazard": "Physical impact, shift of center of gravity, heavy lift strains"},
    "textiles": {"points": 8, "hazard": "Water damage and container condensation sweat"},
    "general": {"points": 6, "hazard": "Standard containerized freight risk profile"},
}

TRANSPORT_MODE_RISK = {
    "multimodal": 18,  # Multiple cargo handoffs at intermodal terminals
    "road": 20,        # Highway accidents, hijacking, rollover
    "sea": 12,         # Marine perils of the sea, heavy weather
    "rail": 10,        # Rail siding derailment, coupling shocks
    "air": 6,          # Safest transit mode, minimal transit duration
}


class RiskAssessmentEngine:

    @classmethod
    def evaluate_route_risk(
        cls,
        origin_country: str,
        origin_location: str,
        dest_country: str,
        dest_location: str,
    ) -> Dict[str, Any]:
        """Examine route text for known chokepoints and maritime high-risk areas."""
        combined_text = f"{origin_country} {origin_location} {dest_country} {dest_location}".lower()
        route_score = 0
        identified_hazards = []

        for zone, data in HIGH_RISK_REGIONS.items():
            if zone in combined_text:
                route_score += data["score"]
                identified_hazards.append({
                    "zone": zone.title(),
                    "risk_points": data["score"],
                    "description": data["reason"],
                })

        # Cap route score at 35 points
        capped_route_score = min(35, max(5, route_score or 8))
        return {
            "route_risk_score": capped_route_score,
            "hazards": identified_hazards,
            "is_war_risk_zone": any("war" in h["description"].lower() or "conflict" in h["description"].lower() for h in identified_hazards),
        }

    @classmethod
    def evaluate_cargo_risk(cls, cargo_category: str) -> Dict[str, Any]:
        cat = cargo_category.lower() if cargo_category else "general"
        factor = CARGO_RISK_FACTORS.get(cat, CARGO_RISK_FACTORS["general"])
        return {
            "cargo_category": cat,
            "cargo_risk_score": factor["points"],
            "hazard_description": factor["hazard"],
        }

    @classmethod
    def evaluate_value_exposure(cls, insured_amount: Decimal) -> Dict[str, Any]:
        """Score financial exposure based on aggregate policy liability."""
        amt = float(insured_amount)
        if amt > 50_000_000:
            score = 25
            level = "Extremely High Aggregate Value Exposure"
        elif amt > 20_000_000:
            score = 18
            level = "High Value Exposure"
        elif amt > 5_000_000:
            score = 12
            level = "Moderate Value Exposure"
        else:
            score = 6
            level = "Standard Value Exposure"

        return {
            "value_risk_score": score,
            "exposure_level": level,
        }

    @classmethod
    def calculate_composite_risk(
        cls,
        insured_amount: Decimal,
        cargo_category: str,
        transport_mode: str,
        origin_country: str,
        origin_location: str,
        dest_country: str,
        dest_location: str,
    ) -> Dict[str, Any]:
        """Compute end-to-end multi-factor risk assessment (0-100 scale)."""
        # 1. Component scores
        cargo_eval = cls.evaluate_cargo_risk(cargo_category)
        route_eval = cls.evaluate_route_risk(
            origin_country, origin_location, dest_country, dest_location
        )
        val_eval = cls.evaluate_value_exposure(insured_amount)
        mode_score = TRANSPORT_MODE_RISK.get(transport_mode.lower(), 12)

        # 2. Total score calculation (clamped to 0-100)
        raw_score = (
            cargo_eval["cargo_risk_score"]
            + route_eval["route_risk_score"]
            + val_eval["value_risk_score"]
            + mode_score
        )
        composite_score = min(100, max(5, raw_score))

        # 3. Determine Risk Category Tier
        if composite_score <= 35:
            tier = "LOW"
            color = "emerald"
            recommendation = "Approved for Standard Terms. Fast-track automated underwriting eligible."
            suggested_conditions = ["Standard Institute Cargo Clauses (A)", "Standard 5% Deductible"]
        elif composite_score <= 65:
            tier = "MODERATE"
            color = "amber"
            recommendation = "Acceptable risk profile. Standard underwriting verification with spot checks."
            suggested_conditions = [
                "Institute Cargo Clauses (A)",
                "Standard Deductible (₹5,000 minimum)",
                "Approved Carrier and Vessel Age Warranty (<25 years)",
            ]
        elif composite_score <= 85:
            tier = "HIGH"
            color = "rose"
            recommendation = "Elevated risk profile. Mandatory pre-shipment surveyor inspection and enhanced warranties."
            suggested_conditions = [
                "Enhanced Deductible (10% or min ₹15,000)",
                "Pre-shipment Container Inspection Survey Certificate Required",
                "Reefer Temperature Datalogger Continuous Monitoring Warranty (if applicable)",
                "Armed Escort or Route Deviation Monitoring Warranty",
            ]
        else:
            tier = "CRITICAL"
            color = "purple"
            recommendation = "Exceptional risk severity. Referral to Senior Marine Underwriter; Facultative Reinsurance required."
            suggested_conditions = [
                "Senior Officer Sign-off Mandatory",
                "Facultative Reinsurance Placement Required",
                "War Risk Surcharge or Geographical Route Exclusion Clause",
                "Minimum 15% Deductible with Restricted Perils",
            ]

        return {
            "composite_score": composite_score,
            "risk_tier": tier,
            "color_tag": color,
            "recommendation": recommendation,
            "suggested_warranties": suggested_conditions,
            "components": {
                "cargo_risk": cargo_eval,
                "route_risk": route_eval,
                "value_exposure": val_eval,
                "transport_mode_score": mode_score,
            },
        }

    @classmethod
    def evaluate_application(cls, db: Session, application_id: str) -> Dict[str, Any]:
        """Evaluate an existing insurance application record."""
        app_record = db.query(InsuranceApplication).filter(InsuranceApplication.id == application_id).first()
        if not app_record:
            return {"error": "Application not found"}

        shipment = app_record.shipment
        cargo_cat = shipment.cargo_items[0].category if shipment.cargo_items else "general"

        evaluation = cls.calculate_composite_risk(
            insured_amount=app_record.requested_insured_amount,
            cargo_category=cargo_cat,
            transport_mode=shipment.transport_mode,
            origin_country=shipment.origin_country,
            origin_location=shipment.origin_location,
            dest_country=shipment.destination_country,
            dest_location=shipment.destination_location,
        )
        evaluation["application_number"] = app_record.application_number
        evaluation["shipment_number"] = shipment.shipment_number
        return evaluation
