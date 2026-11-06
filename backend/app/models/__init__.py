"""SQLAlchemy models. Importing this package registers tables on Base.metadata."""

from app.models.agent_audit import (  # noqa: F401
    AgentCommission,
    AuditLog,
    Notification,
)
from app.models.telemetry_ai import (  # noqa: F401
    ContainerTelemetry,
    DocumentExtractionRecord,
)
from app.models.claim_incident import (  # noqa: F401
    Claim,
    Incident,
    SurveyReport,
)
from app.models.payment_policy import (  # noqa: F401
    PaymentOrder,
    PaymentTransaction,
    Policy,
    PolicyCancellation,
    PolicyEndorsement,
    PolicyRenewal,
)
from app.models.insurance import (  # noqa: F401
    InsuranceApplication,
    InsuranceProduct,
    PremiumRule,
    ProductCoverage,
    ProductExclusion,
    Quotation,
    UnderwritingReview,
)
from app.models.shipment import (  # noqa: F401
    CargoItem,
    Shipment,
    ShipmentContainer,
    ShipmentDocument,
    ShipmentMilestone,
    ShipmentRoute,
)
from app.models.user import (  # noqa: F401
    AgentProfile,
    CustomerProfile,
    EmailVerification,
    LoginHistory,
    OfficerProfile,
    PasswordResetToken,
    Role,
    ShippingCompanyProfile,
    SurveyorProfile,
    User,
    UserSession,
)

__all__ = [
    "PaymentOrder",
    "PaymentTransaction",
    "Policy",
    "PolicyEndorsement",
    "PolicyRenewal",
    "PolicyCancellation",
    "InsuranceProduct",
    "ProductCoverage",
    "ProductExclusion",
    "PremiumRule",
    "Quotation",
    "InsuranceApplication",
    "UnderwritingReview",
    "Shipment",
    "CargoItem",
    "ShipmentContainer",
    "ShipmentDocument",
    "ShipmentMilestone",
    "ShipmentRoute",
    "User",
    "Role",
    "CustomerProfile",
    "ShippingCompanyProfile",
    "SurveyorProfile",
    "AgentProfile",
    "OfficerProfile",
    "EmailVerification",
    "PasswordResetToken",
    "UserSession",
    "LoginHistory",
]
