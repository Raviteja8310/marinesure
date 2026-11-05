"""
MarineSure 2.0 – Database Base Model & Common Mixins
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer
from sqlalchemy.orm import declared_attr


class TimestampMixin:
    """Provides automatic created_at and updated_at timestamps."""

    @declared_attr
    def created_at(cls):
        return Column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            nullable=False,
        )

    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            onupdate=lambda: datetime.now(timezone.utc),
            nullable=False,
        )


class SoftDeleteMixin:
    """Provides soft-delete capability."""

    @declared_attr
    def is_deleted(cls):
        return Column(Integer, default=0, nullable=False, index=True)

    @declared_attr
    def deleted_at(cls):
        return Column(DateTime(timezone=True), nullable=True)
