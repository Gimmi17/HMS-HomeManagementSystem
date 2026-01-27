"""
Shopping List Schemas

Pydantic models for Shopping List API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from enum import Enum


class ShoppingListStatusEnum(str, Enum):
    """Shopping list status values"""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VerificationStatusEnum(str, Enum):
    """Load verification status values"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"


# Item Schemas

class ShoppingListItemBase(BaseModel):
    """Base schema for shopping list items"""
    name: str = Field(..., min_length=1, max_length=255, description="Item name")
    grocy_product_id: Optional[int] = Field(None, description="Grocy product ID if linked")
    grocy_product_name: Optional[str] = Field(None, description="Grocy product name if linked")
    quantity: int = Field(1, ge=1, description="Quantity")
    unit: Optional[str] = Field(None, max_length=50, description="Unit of measurement")


class ShoppingListItemCreate(ShoppingListItemBase):
    """Schema for creating a shopping list item"""
    position: Optional[int] = Field(None, description="Position in list")
    category_id: Optional[UUID] = Field(None, description="Category ID")


class ShoppingListItemUpdate(BaseModel):
    """Schema for updating a shopping list item"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=1)
    unit: Optional[str] = Field(None, max_length=50)
    checked: Optional[bool] = None
    scanned_barcode: Optional[str] = Field(None, max_length=100)
    verified_quantity: Optional[float] = Field(None, ge=0)
    verified_unit: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[date] = Field(None, description="Expiry date of the purchased product")
    category_id: Optional[UUID] = Field(None, description="Category ID")


class ShoppingListItemResponse(ShoppingListItemBase):
    """Schema for shopping list item response"""
    id: UUID
    position: int
    checked: bool
    checked_at: Optional[datetime] = None
    scanned_barcode: Optional[str] = None
    verified_at: Optional[datetime] = None
    verified_quantity: Optional[float] = None
    verified_unit: Optional[str] = None
    not_purchased: bool = False
    not_purchased_at: Optional[datetime] = None
    expiry_date: Optional[date] = None
    category_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# List Schemas

class ShoppingListBase(BaseModel):
    """Base schema for shopping list"""
    name: str = Field(..., min_length=1, max_length=255, description="List name")


class ShoppingListCreate(BaseModel):
    """Schema for creating a shopping list"""
    house_id: UUID = Field(..., description="House ID")
    store_id: Optional[UUID] = Field(None, description="Store ID for ordering")
    name: Optional[str] = Field(None, max_length=255, description="List name (auto-generated if not provided)")
    items: List[ShoppingListItemCreate] = Field(default=[], description="Initial items")


class ShoppingListUpdate(BaseModel):
    """Schema for updating a shopping list"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    store_id: Optional[UUID] = Field(None, description="Store ID for ordering")
    status: Optional[ShoppingListStatusEnum] = None
    verification_status: Optional[VerificationStatusEnum] = None


class ShoppingListResponse(ShoppingListBase):
    """Schema for shopping list response"""
    id: UUID
    house_id: UUID
    store_id: Optional[UUID] = None
    store_name: Optional[str] = None
    created_by: Optional[UUID] = None
    status: ShoppingListStatusEnum
    verification_status: VerificationStatusEnum = VerificationStatusEnum.NOT_STARTED
    editing_by: Optional[UUID] = None
    editing_since: Optional[datetime] = None
    items: List[ShoppingListItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EditLockResponse(BaseModel):
    """Schema for edit lock response"""
    success: bool
    message: str
    editing_by: Optional[UUID] = None
    editor_name: Optional[str] = None


class ShoppingListSummary(BaseModel):
    """Schema for shopping list summary (without items)"""
    id: UUID
    house_id: UUID
    store_id: Optional[UUID] = None
    store_name: Optional[str] = None
    name: str
    status: ShoppingListStatusEnum
    verification_status: VerificationStatusEnum = VerificationStatusEnum.NOT_STARTED
    item_count: int = Field(0, description="Number of items")
    checked_count: int = Field(0, description="Number of checked items")
    verified_count: int = Field(0, description="Number of verified items")
    not_purchased_count: int = Field(0, description="Number of items marked as not purchased")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShoppingListsResponse(BaseModel):
    """Schema for paginated shopping lists response"""
    lists: List[ShoppingListSummary]
    total: int
    limit: int
    offset: int


# Barcode Scan Schemas

class BarcodeScanRequest(BaseModel):
    """Schema for barcode scan request"""
    item_id: UUID = Field(..., description="Shopping list item ID")
    barcode: str = Field(..., min_length=1, max_length=100, description="Scanned barcode")


class BarcodeScanResponse(BaseModel):
    """Schema for barcode scan response"""
    success: bool
    message: str
    item_id: UUID
    barcode: str
    product_name: Optional[str] = None
