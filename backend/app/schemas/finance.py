from typing import Optional
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


ENTRY_TYPES = {"income", "expense"}
ENTRY_SUBTYPES = {"recurring", "done"}
FREQUENCIES = {"monthly", "weekly", "every_n_months"}


class FinanceEntryCreate(BaseModel):
    label: str = Field(..., max_length=255)
    amount: float
    type: str
    subtype: str
    frequency: Optional[str] = None
    frequency_n: Optional[int] = Field(None, ge=1, le=60)
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("type")
    @classmethod
    def v_type(cls, v):
        if v not in ENTRY_TYPES:
            raise ValueError(f"type must be one of {ENTRY_TYPES}")
        return v

    @field_validator("subtype")
    @classmethod
    def v_subtype(cls, v):
        if v not in ENTRY_SUBTYPES:
            raise ValueError(f"subtype must be one of {ENTRY_SUBTYPES}")
        return v

    @field_validator("frequency")
    @classmethod
    def v_freq(cls, v):
        if v and v not in FREQUENCIES:
            raise ValueError(f"frequency must be one of {FREQUENCIES}")
        return v


class FinanceEntryUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=255)
    amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class FinanceEntryResponse(BaseModel):
    id: UUID
    user_id: UUID
    house_id: UUID
    label: str
    amount: float
    type: str
    subtype: str
    frequency: Optional[str] = None
    frequency_n: Optional[int] = None
    date: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FinanceSavingsPayload(BaseModel):
    amount: float = 0
    resign_date: Optional[date] = None


class FinanceSavingsResponse(BaseModel):
    amount: float = 0
    resign_date: Optional[date] = None
    model_config = ConfigDict(from_attributes=True)


class RevolutMovementCreate(BaseModel):
    label: str = Field(..., max_length=255)
    amount: float
    category: str = Field("Altro", max_length=80)
    date: date
    notes: Optional[str] = None


class RevolutMovementResponse(BaseModel):
    id: UUID
    user_id: UUID
    house_id: UUID
    label: str
    amount: float
    category: str
    date: date
    notes: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class OCREntryParsed(BaseModel):
    label: str
    amount: float
    type: str
    date: Optional[date] = None
    subtype: str = "done"


class HouseMemberSummary(BaseModel):
    user_id: UUID
    name: str
    monthly_income: float
    monthly_expense: float
    leftover: float
    savings: float


class HouseFinanceSummary(BaseModel):
    members: list[HouseMemberSummary]
    total_income: float
    total_expense: float
    total_savings: float
    total_leftover: float
