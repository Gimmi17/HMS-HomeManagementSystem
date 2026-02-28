"""
Area Schemas
Pydantic models for Area API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class AreaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Area name")
    icon: Optional[str] = Field(None, max_length=50, description="Emoji icon")
    area_type: Optional[str] = Field("general", description="Type: food_storage, equipment, general")
    description: Optional[str] = Field(None, max_length=500, description="Description")
    position: Optional[int] = Field(0, description="Sort position")
    expiry_extension_enabled: Optional[bool] = Field(False, description="Show expiry extension choice on insert")
    disable_expiry_tracking: Optional[bool] = Field(False, description="Disable expiry notifications for items")
    warranty_tracking_enabled: Optional[bool] = Field(False, description="Enable warranty date field")
    default_warranty_months: Optional[int] = Field(None, description="Default warranty months")
    trial_period_enabled: Optional[bool] = Field(False, description="Enable trial/return period field")
    default_trial_days: Optional[int] = Field(None, description="Default trial period days")


class AreaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    icon: Optional[str] = Field(None, max_length=50)
    area_type: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None
    expiry_extension_enabled: Optional[bool] = None
    disable_expiry_tracking: Optional[bool] = None
    warranty_tracking_enabled: Optional[bool] = None
    default_warranty_months: Optional[int] = None
    trial_period_enabled: Optional[bool] = None
    default_trial_days: Optional[int] = None


class AreaResponse(BaseModel):
    id: UUID
    house_id: UUID
    name: str
    icon: Optional[str] = None
    area_type: str
    description: Optional[str] = None
    is_default: bool
    position: int
    expiry_extension_enabled: bool = False
    disable_expiry_tracking: bool = False
    warranty_tracking_enabled: bool = False
    default_warranty_months: Optional[int] = None
    trial_period_enabled: bool = False
    default_trial_days: Optional[int] = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AreaListResponse(BaseModel):
    areas: list[AreaResponse]
    total: int


class ExpenseByCategory(BaseModel):
    category_id: Optional[UUID] = None
    category_name: str
    total: float


class ExpenseByMonth(BaseModel):
    month: str
    total: float


class AreaExpenseStats(BaseModel):
    total_spent: float
    by_category: list[ExpenseByCategory]
    by_month: list[ExpenseByMonth]
