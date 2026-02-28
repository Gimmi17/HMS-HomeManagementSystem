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
    original_expiry_date: Optional[date] = Field(None, description="Original expiry date before extension")
    barcode: Optional[str] = Field(None, max_length=100, description="Barcode")
    grocy_product_id: Optional[int] = Field(None, description="Grocy product ID")
    grocy_product_name: Optional[str] = Field(None, max_length=255, description="Grocy product name")
    source_item_id: Optional[UUID] = Field(None, description="Source shopping list item ID")
    area_id: Optional[UUID] = Field(None, description="Area ID")
    purchase_price: Optional[float] = Field(None, ge=0, description="Purchase price")
    notes: Optional[str] = Field(None, max_length=500, description="Notes")
    warranty_expiry_date: Optional[date] = Field(None, description="Warranty expiry date")
    trial_expiry_date: Optional[date] = Field(None, description="Trial/return period expiry date")


class DispensaItemUpdate(BaseModel):
    """Schema for updating a dispensa item"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=50)
    category_id: Optional[UUID] = None
    expiry_date: Optional[date] = None
    original_expiry_date: Optional[date] = None
    barcode: Optional[str] = Field(None, max_length=100)
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = Field(None, max_length=255)
    area_id: Optional[UUID] = None
    purchase_price: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=500)
    warranty_expiry_date: Optional[date] = None
    trial_expiry_date: Optional[date] = None


class DispensaItemResponse(BaseModel):
    """Schema for dispensa item response"""
    id: UUID
    house_id: UUID
    name: str
    quantity: float
    unit: Optional[str] = None
    category_id: Optional[UUID] = None
    expiry_date: Optional[date] = None
    original_expiry_date: Optional[date] = None
    barcode: Optional[str] = None
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = None
    source_list_id: Optional[UUID] = None
    source_item_id: Optional[UUID] = None
    added_by: Optional[UUID] = None
    area_id: Optional[UUID] = None
    purchase_price: Optional[float] = None
    is_consumed: bool
    consumed_at: Optional[datetime] = None
    notes: Optional[str] = None
    warranty_expiry_date: Optional[date] = None
    trial_expiry_date: Optional[date] = None
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
    item_areas: Optional[dict[str, str]] = Field(None, description="Map of item_id → area_id overrides")
    item_expiry_extensions: Optional[dict[str, int]] = Field(None, description="Map of item_id → extension days")


class PreviewFromShoppingListRequest(BaseModel):
    """Schema for previewing items before sending to dispensa"""
    shopping_list_id: UUID = Field(..., description="Shopping list ID to preview")


class PreviewItemResponse(BaseModel):
    """Single item in the preview response"""
    item_id: UUID
    name: str
    quantity: float
    unit: Optional[str] = None
    category_name: Optional[str] = None
    area_id: Optional[UUID] = None
    area_name: Optional[str] = None


class PreviewAreaResponse(BaseModel):
    """Area info in the preview response"""
    id: UUID
    name: str
    icon: Optional[str] = None
    expiry_extension_enabled: bool = False
    disable_expiry_tracking: bool = False
    warranty_tracking_enabled: bool = False
    default_warranty_months: Optional[int] = None
    trial_period_enabled: bool = False
    default_trial_days: Optional[int] = None


class PreviewFromShoppingListResponse(BaseModel):
    """Response for preview-from-shopping-list"""
    items: list[PreviewItemResponse]
    areas: list[PreviewAreaResponse]


class ConsumeItemRequest(BaseModel):
    """Schema for consuming an item (partial or total)"""
    quantity: Optional[float] = Field(None, gt=0, description="Quantity to consume (None = consume all)")
