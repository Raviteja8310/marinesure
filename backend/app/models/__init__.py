"""SQLAlchemy models. Importing this package registers tables on Base.metadata."""

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
