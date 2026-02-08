"""
Store Schemas
Pydantic models for Store API request/response validation.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime


# Store size options
StoreSize = Literal["S", "M", "L", "XL", "XXL"]


class StoreCreate(BaseModel):
    """Schema for creating a store"""
    chain: Optional[str] = Field(None, max_length=255, description="Chain name (e.g., Esselunga, Lidl)")
    name: str = Field(..., min_length=1, max_length=255, description="Store name")
    address: Optional[str] = Field(None, max_length=500, description="Store address")
    country: Optional[str] = Field(None, max_length=100, description="Country")
    size: Optional[StoreSize] = Field(None, description="Store size (S, M, L, XL, XXL)")


class StoreUpdate(BaseModel):
    """Schema for updating a store"""
    chain: Optional[str] = Field(None, max_length=255)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    country: Optional[str] = Field(None, max_length=100)
    size: Optional[StoreSize] = Field(None)


class StoreResponse(BaseModel):
    """Schema for store response"""
    id: UUID
    house_id: Optional[UUID] = None
    chain: Optional[str] = None
    name: str
    address: Optional[str] = None
    country: Optional[str] = None
    size: Optional[str] = None
    display_name: str
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('size', mode='before')
    @classmethod
    def convert_size_enum(cls, v):
        if v is None:
            return None
        if hasattr(v, 'value'):
            return v.value
        return v


class StoresResponse(BaseModel):
    """Schema for paginated stores response"""
    stores: list[StoreResponse]
    total: int
