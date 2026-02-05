"""
Dispensa Schemas
Pydantic models for Dispensa API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime, date


class DispensaItemCreate(BaseModel):
    """Schema for creating a dispensa item"""
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    quantity: float = Field(1.0, gt=0, description="Quantity")
    unit: Optional[str] = Field(None, max_length=50, description="Unit (pz, kg, g, l, ml)")
    category_id: Optional[UUID] = Field(None, description="Category ID")
    expiry_date: Optional[date] = Field(None, description="Expiry date")
    barcode: Optional[str] = Field(None, max_length=100, description="Barcode")
    grocy_product_id: Optional[int] = Field(None, description="Grocy product ID")
    grocy_product_name: Optional[str] = Field(None, max_length=255, description="Grocy product name")
    source_item_id: Optional[UUID] = Field(None, description="Source shopping list item ID")
    notes: Optional[str] = Field(None, max_length=500, description="Notes")


class DispensaItemUpdate(BaseModel):
    """Schema for updating a dispensa item"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=50)
    category_id: Optional[UUID] = None
    expiry_date: Optional[date] = None
    barcode: Optional[str] = Field(None, max_length=100)
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=500)


class DispensaItemResponse(BaseModel):
    """Schema for dispensa item response"""
    id: UUID
    house_id: UUID
    name: str
    quantity: float
    unit: Optional[str] = None
    category_id: Optional[UUID] = None
    expiry_date: Optional[date] = None
    barcode: Optional[str] = None
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = None
    source_list_id: Optional[UUID] = None
    source_item_id: Optional[UUID] = None
    added_by: Optional[UUID] = None
    is_consumed: bool
    consumed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DispensaStatsResponse(BaseModel):
    """Schema for dispensa stats"""
    total: int
    expiring_soon: int
    expired: int


class DispensaItemListResponse(BaseModel):
    """Schema for list of dispensa items"""
    items: list[DispensaItemResponse]
    total: int
    stats: DispensaStatsResponse


class SendToDispensaRequest(BaseModel):
    """Schema for sending shopping list items to dispensa"""
    shopping_list_id: UUID = Field(..., description="Shopping list ID to send items from")


class ConsumeItemRequest(BaseModel):
    """Schema for consuming an item (partial or total)"""
    quantity: Optional[float] = Field(None, gt=0, description="Quantity to consume (None = consume all)")
