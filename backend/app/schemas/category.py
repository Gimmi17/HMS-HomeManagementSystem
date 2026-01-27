"""
Category Schemas
Pydantic models for Category API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class CategoryCreate(BaseModel):
    """Schema for creating a category"""
    name: str = Field(..., min_length=1, max_length=100, description="Category name")
    description: Optional[str] = Field(None, max_length=500, description="Category description")
    icon: Optional[str] = Field(None, max_length=50, description="Icon or emoji")
    color: Optional[str] = Field(None, max_length=7, description="Hex color code (e.g., #FF5733)")
    sort_order: int = Field(0, description="Sort order for display")


class CategoryUpdate(BaseModel):
    """Schema for updating a category"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=7)
    sort_order: Optional[int] = None


class CategoryResponse(BaseModel):
    """Schema for category response"""
    id: UUID
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    sort_order: int
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CategoriesResponse(BaseModel):
    """Schema for list of categories response"""
    categories: list[CategoryResponse]
    total: int
