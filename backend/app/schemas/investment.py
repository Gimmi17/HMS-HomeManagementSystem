"""
Investment Schemas
Pydantic models for investment CRUD and snapshots.
"""

from typing import Optional
from uuid import UUID
from datetime import date, datetime

from pydantic import BaseModel


class InvestmentCreate(BaseModel):
    name: str
    type: str  # pac | pension | etf | stock | crypto | real_estate | other
    provider: Optional[str] = None
    description: Optional[str] = None
    currency: str = "EUR"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    provider: Optional[str] = None
    description: Optional[str] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class InvestmentResponse(BaseModel):
    id: UUID
    user_id: UUID
    house_id: UUID
    name: str
    type: str
    provider: Optional[str]
    description: Optional[str]
    currency: str
    start_date: Optional[date]
    end_date: Optional[date]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SnapshotCreate(BaseModel):
    snapshot_date: date
    current_value: float
    invested_amount: Optional[float] = None
    units: Optional[float] = None
    nav: Optional[float] = None
    notes: Optional[str] = None


class SnapshotResponse(BaseModel):
    id: UUID
    investment_id: UUID
    snapshot_date: date
    current_value: float
    invested_amount: Optional[float]
    units: Optional[float]
    nav: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LinkEntryPayload(BaseModel):
    investment_id: Optional[UUID] = None  # None = unlink
