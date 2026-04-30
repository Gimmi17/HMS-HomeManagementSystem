"""
Investment Models
Tracks investments (PAC, pension, ETF, etc.) with periodic snapshots.
"""

from sqlalchemy import Column, ForeignKey, String, Date, Numeric, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Investment(BaseModel):
    __tablename__ = "investments"

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
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # pac | pension | etf | stock | crypto | real_estate | other
    provider = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    currency = Column(String(10), nullable=False, default="EUR")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)


class InvestmentSnapshot(BaseModel):
    __tablename__ = "investment_snapshots"

    investment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("investments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_date = Column(Date, nullable=False)
    current_value = Column(Numeric(14, 2), nullable=False)
    invested_amount = Column(Numeric(14, 2), nullable=True)
    units = Column(Numeric(16, 6), nullable=True)
    nav = Column(Numeric(12, 6), nullable=True)
    notes = Column(Text, nullable=True)
