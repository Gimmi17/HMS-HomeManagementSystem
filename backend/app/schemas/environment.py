"""
Environment Schemas
Pydantic models for Environment API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class EnvironmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Environment name")
    icon: Optional[str] = Field(None, max_length=50, description="Emoji icon")
    env_type: Optional[str] = Field("general", description="Type: food_storage, equipment, general")
    description: Optional[str] = Field(None, max_length=500, description="Description")
    position: Optional[int] = Field(0, description="Sort position")


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    icon: Optional[str] = Field(None, max_length=50)
    env_type: Optional[str] = Field(None)
    description: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None


class EnvironmentResponse(BaseModel):
    id: UUID
    house_id: UUID
    name: str
    icon: Optional[str] = None
    env_type: str
    description: Optional[str] = None
    is_default: bool
    position: int
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EnvironmentListResponse(BaseModel):
    environments: list[EnvironmentResponse]
    total: int


class ExpenseByCategory(BaseModel):
    category_id: Optional[UUID] = None
    category_name: str
    total: float


class ExpenseByMonth(BaseModel):
    month: str
    total: float


class EnvironmentExpenseStats(BaseModel):
    total_spent: float
    by_category: list[ExpenseByCategory]
    by_month: list[ExpenseByMonth]
