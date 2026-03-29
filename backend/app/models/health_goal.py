from sqlalchemy import Column, ForeignKey, String, Numeric, Date, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class HealthGoal(BaseModel):
    __tablename__ = "health_goals"

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
    metric = Column(String(50), nullable=False)
    target_value = Column(Numeric(10, 3), nullable=False)
    started_value = Column(Numeric(10, 3), nullable=True)
    deadline = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, server_default="active")  # active/achieved/abandoned
    notes = Column(Text, nullable=True)
