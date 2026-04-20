"""
Finance Models
Personal finance tracking: entries (income/expense), savings, Revolut movements.
"""

from sqlalchemy import Column, ForeignKey, String, Date, Numeric, Text, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class FinanceEntry(BaseModel):
    __tablename__ = "finance_entries"

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
    label = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(20), nullable=False)  # income | expense
    subtype = Column(String(20), nullable=False)  # recurring | done
    frequency = Column(String(30), nullable=True)  # monthly | weekly | every_n_months
    frequency_n = Column(Integer, nullable=True)
    date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)


class FinanceSavings(BaseModel):
    __tablename__ = "finance_savings"

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
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    resign_date = Column(Date, nullable=True)


class RevolutMovement(BaseModel):
    __tablename__ = "revolut_movements"

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
    label = Column(String(255), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String(80), nullable=False, default="Altro")
    date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
