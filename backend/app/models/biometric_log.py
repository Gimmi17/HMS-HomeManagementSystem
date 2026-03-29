from sqlalchemy import Column, ForeignKey, String, Numeric, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class BiometricLog(BaseModel):
    __tablename__ = "biometric_logs"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    metric = Column(String(50), nullable=False)  # weight_kg/body_fat_pct/waist_cm/...
    value = Column(Numeric(10, 3), nullable=False)
    unit = Column(String(20), nullable=True)
    source = Column(String(50), nullable=False, server_default="manual")
    notes = Column(Text, nullable=True)
    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
