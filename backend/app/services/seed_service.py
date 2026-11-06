"""
MarineSure 2.0 – Comprehensive Demo Environment & Master Data Seeder.

Seeds realistic accounts, profiles, shipments, products, policies, claims,
surveyor reports, IoT telemetry, and broker commissions for interactive demos.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.agent_audit import AgentCommission, AuditLog, Notification
from app.models.claim_incident import Claim, Incident, SurveyReport
from app.models.insurance import (
    InsuranceApplication,
    InsuranceProduct,
    Quotation,
)
from app.models.payment_policy import (
    PaymentOrder,
    PaymentTransaction,
    Policy,
)
from app.models.shipment import (
    CargoItem,
    Shipment,
    ShipmentContainer,
    ShipmentMilestone,
    ShipmentRoute,
)
from app.models.telemetry_ai import ContainerTelemetry
from app.models.user import (
    AgentProfile,
    CustomerProfile,
    OfficerProfile,
    Role,
    ShippingCompanyProfile,
    SurveyorProfile,
    User,
)
from app.services.agent_service import AuditService, NotificationService
from app.services.auth_service import seed_roles
from app.services.insurance_service import seed_insurance_products

DEFAULT_DEMO_PASSWORD = "MarineSure@2026"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def seed_demo_environment(db: Session) -> Dict[str, Any]:
    """Execute end-to-end idempotent seeding of all platform roles and domain entities."""
    # 1. Base roles and products
    seed_roles(db)
    seed_insurance_products(db)

    roles = {r.role_name: r for r in db.query(Role).all()}
    pwd_hash = hash_password(DEFAULT_DEMO_PASSWORD)

    # 2. Demo Users for all 6 personas
    demo_users_spec = [
        {
            "name": "Reliance Global Impex",
            "email": "customer@marinesure.com",
            "roles": ["customer"],
            "profile_type": "customer",
            "profile": {
                "company_name": "Reliance Global Impex Ltd",
                "customer_type": "corporate",
                "phone": "+91 98200 11223",
                "country": "India",
            },
        },
        {
            "name": "Maersk Line Logistics",
            "email": "carrier@marinesure.com",
            "roles": ["shipping_company"],
            "profile_type": "shipping",
            "profile": {
                "company_name": "A.P. Moller - Maersk Ocean Freight",
                "registration_number": "IMO-LINE-910284",
                "phone": "+45 33 63 33 63",
            },
        },
        {
            "name": "Capt. Rajesh Varma",
            "email": "surveyor@marinesure.com",
            "roles": ["surveyor"],
            "profile_type": "surveyor",
            "profile": {
                "qualification": "Master Mariner / Certified Marine Cargo Surveyor (FICS)",
                "license_number": "SURV-IND-2026-8819",
                "phone": "+91 98190 44556",
            },
        },
        {
            "name": "Apex Marine Insurance Brokers",
            "email": "agent@marinesure.com",
            "roles": ["agent"],
            "profile_type": "agent",
            "profile": {
                "agency_name": "Apex Maritime Risk & Insurance Intermediaries",
                "license_number": "IRDA-AG-991204",
                "phone": "+91 22 6677 8899",
            },
        },
        {
            "name": "Vikram Malhotra",
            "email": "officer@marinesure.com",
            "roles": ["insurance_officer"],
            "profile_type": "officer",
            "profile": {
                "employee_code": "OFF-2026-0042",
                "department": "Marine Hull & Cargo Underwriting",
                "designation": "insurance_officer",
            },
        },
        {
            "name": "Eleanor Vance (Admin)",
            "email": "admin@marinesure.com",
            "roles": ["admin"],
            "profile_type": "officer",
            "profile": {
                "employee_code": "ADM-2026-0001",
                "department": "Platform Administration",
                "designation": "admin",
            },
        },
    ]

    created_users = {}
    for spec in demo_users_spec:
        user = db.query(User).filter(User.email == spec["email"]).first()
        if not user:
            user = User(
                name=spec["name"],
                email=spec["email"],
                password_hash=pwd_hash,
                status="active",
                email_verified=True,
            )
            for rname in spec["roles"]:
                if rname in roles:
                    user.roles.append(roles[rname])

            # Attach role-specific profile
            ptype = spec["profile_type"]
            pdata = spec["profile"]
            if ptype == "customer":
                user.customer_profile = CustomerProfile(**pdata)
            elif ptype == "shipping":
                user.shipping_profile = ShippingCompanyProfile(**pdata)
            elif ptype == "surveyor":
                user.surveyor_profile = SurveyorProfile(**pdata)
            elif ptype == "agent":
                user.agent_profile = AgentProfile(**pdata)
            elif ptype == "officer":
                user.officer_profile = OfficerProfile(**pdata)

            db.add(user)
            db.commit()
            db.refresh(user)
        created_users[spec["email"]] = user

    cust = created_users["customer@marinesure.com"]
    carrier = created_users["carrier@marinesure.com"]
    surveyor = created_users["surveyor@marinesure.com"]
    agent = created_users["agent@marinesure.com"]
    officer = created_users["officer@marinesure.com"]
    admin = created_users["admin@marinesure.com"]

    # 3. Seed Realistic Shipments
    products = {p.product_code: p for p in db.query(InsuranceProduct).all()}
    mci = products.get("MCI")
    scc = products.get("SCC") or mci

    # Shipment 1: Perishable Reefer Shipment with Active Policy & Telemetry
    s1 = db.query(Shipment).filter(Shipment.shipment_number == "SHP-2026-000101").first()
    if not s1:
        s1 = Shipment(
            shipment_number="SHP-2026-000101",
            customer_id=cust.id,
            shipping_company_id=carrier.id,
            transport_mode="sea",
            origin_country="India",
            origin_location="Jawaharlal Nehru Port (Nhava Sheva)",
            destination_country="Netherlands",
            destination_location="Port of Rotterdam",
            departure_date=date.today() - timedelta(days=12),
            expected_arrival_date=date.today() + timedelta(days=14),
            currency="INR",
            declared_value=Decimal("4500000.00"),
            status="in_transit",
        )
        s1.cargo_items.append(
            CargoItem(
                cargo_name="Premium Frozen Black Tiger Shrimps",
                category="perishable",
                quantity=1200,
                unit="cartons",
                value=Decimal("4500000.00"),
            )
        )
        s1.containers.append(
            ShipmentContainer(
                container_number="MSCU9182340",
                container_type="40ft_reefer",
                seal_number="SL-884910",
            )
        )
        s1.milestones.append(
            ShipmentMilestone(
                status="dispatched",
                location="Nhava Sheva Terminal 3",
                event_time=_now() - timedelta(days=12),
                recorded_by=carrier.id,
                remarks="Loaded aboard MV Maersk Mc-Kinney Moller",
            )
        )
        s1.milestones.append(
            ShipmentMilestone(
                status="in_transit",
                location="Red Sea / Bab-el-Mandeb Strait",
                event_time=_now() - timedelta(days=4),
                recorded_by=carrier.id,
                remarks="Transit via Red Sea corridor under naval escort",
            )
        )
        db.add(s1)
        db.commit()
        db.refresh(s1)

    # 4. Policy and Claim for Shipment 1
    pol1 = db.query(Policy).filter(Policy.policy_number == "POL-2026-000101").first()
    if not pol1 and s1 and scc:
        # App
        app1 = InsuranceApplication(
            application_number="AP-2026-000101",
            customer_id=cust.id,
            shipment_id=s1.id,
            product_id=scc.id,
            requested_insured_amount=Decimal("4500000.00"),
            calculated_premium=Decimal("38500.00"),
            status="approved",
            officer_remarks="Fast-track underwriting approval. Specialized Reefer Clauses applied.",
        )
        db.add(app1)
        db.commit()
        db.refresh(app1)

        # Payment
        order1 = PaymentOrder(
            order_reference="ORD-2026-000101",
            customer_id=cust.id,
            application_id=app1.id,
            gateway_order_id="order_demo_101",
            amount=Decimal("38500.00"),
            currency="INR",
            status="paid",
        )
        db.add(order1)
        db.commit()

        # Policy
        pol1 = Policy(
            policy_number="POL-2026-000101",
            application_id=app1.id,
            customer_id=cust.id,
            shipment_id=s1.id,
            product_id=scc.id,
            insured_amount=Decimal("4500000.00"),
            premium_paid=Decimal("38500.00"),
            deductible_amount=Decimal("22500.00"),
            effective_date=date.today() - timedelta(days=12),
            expiry_date=date.today() + timedelta(days=33),
            status="active",
            pdf_storage_key="Policy_POL-2026-000101.pdf",
        )
        db.add(pol1)
        db.commit()
        db.refresh(pol1)

        # Telemetry stream for s1
        t1 = ContainerTelemetry(
            shipment_id=s1.id,
            recorded_at=_now() - timedelta(days=2),
            temperature_celsius=Decimal("-18.4"),
            humidity_pct=Decimal("62.0"),
            shock_g_force=Decimal("0.4"),
            door_status="sealed",
            location_name="Strait of Bab-el-Mandeb",
            is_anomaly=False,
        )
        t2 = ContainerTelemetry(
            shipment_id=s1.id,
            recorded_at=_now() - timedelta(hours=18),
            temperature_celsius=Decimal("-2.5"),  # Temperature breach!
            humidity_pct=Decimal("88.0"),
            shock_g_force=Decimal("1.2"),
            door_status="sealed",
            location_name="Red Sea South",
            is_anomaly=True,
            anomaly_details="Reefer temperature breach: -2.5°C (threshold: -5.0°C)",
        )
        db.add_all([t1, t2])

        # Incident
        inc1 = Incident(
            incident_number="INC-2026-000101",
            shipment_id=s1.id,
            policy_id=pol1.id,
            reported_by_id=cust.id,
            incident_date=_now() - timedelta(hours=16),
            incident_type="reefer_temperature_breach",
            severity="severe",
            location_name="Red Sea South",
            description="Refrigeration unit power failure during severe weather; internal temp rose to -2.5C.",
            estimated_loss=Decimal("650000.00"),
            status="claim_filed",
        )
        db.add(inc1)
        db.commit()
        db.refresh(inc1)

        # Claim
        claim1 = Claim(
            claim_number="CLM-2026-000101",
            policy_id=pol1.id,
            incident_id=inc1.id,
            claimant_id=cust.id,
            assigned_surveyor_id=surveyor.id,
            reviewed_by_id=officer.id,
            claim_amount=Decimal("650000.00"),
            approved_amount=Decimal("600000.00"),
            deductible_applied=Decimal("30000.00"),  # 5% of 600,000
            net_payable=Decimal("570000.00"),
            status="approved",
            claim_type="partial_loss",
            claimant_notes="Reefer datalogger extracts attached. Surface thawing evident.",
            officer_notes="Surveyor report verified. Loss admissible under ICC Reefer Clauses.",
        )
        db.add(claim1)
        db.commit()
        db.refresh(claim1)

        # Survey Report
        sr1 = SurveyReport(
            report_number="SRV-2026-000101",
            claim_id=claim1.id,
            surveyor_id=surveyor.id,
            inspection_date=_now() - timedelta(hours=6),
            inspection_location="Container Freight Station, Port Said",
            damage_assessment="Physical inspection confirms thawing and refreezing ice crystals on cartons 1-400.",
            cause_of_loss="reefer_temperature_breach",
            is_covered_peril=True,
            estimated_loss_amount=Decimal("600000.00"),
            salvage_value=Decimal("30000.00"),
            recommended_settlement=Decimal("600000.00"),
            status="submitted",
        )
        db.add(sr1)

        # Broker commission for Agent
        comm1 = AgentCommission(
            commission_reference="COM-2026-000101",
            agent_id=agent.id,
            policy_id=pol1.id,
            customer_id=cust.id,
            premium_amount=pol1.premium_paid,
            commission_rate=Decimal("10.00"),
            commission_amount=Decimal("3850.00"),
            status="paid",
            payout_reference="DISBURSE-DEMO-2026-01",
            paid_at=_now(),
        )
        db.add(comm1)

        # Notifications
        NotificationService.send(
            db=db,
            user_id=cust.id,
            title="Claim Approved",
            message="Claim CLM-2026-000101 has been approved for net settlement of ₹570,000.",
            notification_type="success",
            link="/customer/claims",
        )
        NotificationService.send(
            db=db,
            user_id=agent.id,
            title="Commission Disbursed",
            message="Broker commission of ₹3,850.00 credited for Policy POL-2026-000101.",
            notification_type="success",
            link="/agent",
        )

        # Compliance Audit Log
        AuditService.record(
            db=db,
            actor_id=officer.id,
            action="CLAIM_APPROVED",
            resource_type="claim",
            resource_id=claim1.id,
            details={"approved_amount": 600000, "net_payable": 570000},
        )
        db.commit()

    return {
        "status": "success",
        "demo_accounts": [
            {"role": "Customer / Shipper", "email": "customer@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
            {"role": "Shipping Line / Carrier", "email": "carrier@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
            {"role": "Marine Surveyor", "email": "surveyor@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
            {"role": "Insurance Agent / Broker", "email": "agent@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
            {"role": "Insurance Officer", "email": "officer@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
            {"role": "Administrator", "email": "admin@marinesure.com", "password": DEFAULT_DEMO_PASSWORD},
        ],
        "seeded_entities": {
            "shipments": db.query(Shipment).count(),
            "policies": db.query(Policy).count(),
            "claims": db.query(Claim).count(),
            "survey_reports": db.query(SurveyReport).count(),
            "telemetry_points": db.query(ContainerTelemetry).count(),
            "commissions": db.query(AgentCommission).count(),
        },
    }
