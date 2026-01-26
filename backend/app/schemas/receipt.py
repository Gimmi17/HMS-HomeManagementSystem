"""
Receipt Schemas

Pydantic models for Receipt API request/response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum


class ReceiptStatusEnum(str, Enum):
    """Receipt processing status"""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    RECONCILED = "reconciled"
    ERROR = "error"


class ReceiptItemMatchStatusEnum(str, Enum):
    """Match status for receipt items"""
    UNMATCHED = "unmatched"
    MATCHED = "matched"
    EXTRA = "extra"
    IGNORED = "ignored"


# Receipt Item Schemas

class ReceiptItemBase(BaseModel):
    """Base schema for receipt items"""
    raw_text: str = Field(..., description="Raw text from OCR")
    parsed_name: Optional[str] = Field(None, description="Parsed product name")
    parsed_quantity: Optional[float] = Field(None, ge=0, description="Parsed quantity")
    parsed_unit_price: Optional[float] = Field(None, ge=0, description="Unit price")
    parsed_total_price: Optional[float] = Field(None, ge=0, description="Total price")


class ReceiptItemResponse(ReceiptItemBase):
    """Schema for receipt item response"""
    id: UUID
    receipt_id: UUID
    position: int
    match_status: ReceiptItemMatchStatusEnum
    shopping_list_item_id: Optional[UUID] = None
    user_corrected_name: Optional[str] = None
    user_confirmed: bool = False
    match_confidence: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReceiptItemUpdate(BaseModel):
    """Schema for updating a receipt item"""
    parsed_name: Optional[str] = Field(None, min_length=1, max_length=255)
    user_corrected_name: Optional[str] = Field(None, max_length=255)
    user_confirmed: Optional[bool] = None
    match_status: Optional[ReceiptItemMatchStatusEnum] = None
    shopping_list_item_id: Optional[UUID] = None


# Receipt Image Schemas

class ReceiptImageResponse(BaseModel):
    """Schema for receipt image response"""
    id: UUID
    receipt_id: UUID
    position: int
    image_path: str
    raw_ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Receipt Schemas

class ReceiptResponse(BaseModel):
    """Schema for receipt response"""
    id: UUID
    shopping_list_id: UUID
    uploaded_by: Optional[UUID] = None
    status: ReceiptStatusEnum
    raw_ocr_text: Optional[str] = None
    ocr_confidence: Optional[float] = None
    store_name_detected: Optional[str] = None
    total_amount_detected: Optional[float] = None
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    images: List[ReceiptImageResponse] = []
    items: List[ReceiptItemResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReceiptSummary(BaseModel):
    """Schema for receipt summary (without items)"""
    id: UUID
    shopping_list_id: UUID
    status: ReceiptStatusEnum
    store_name_detected: Optional[str] = None
    total_amount_detected: Optional[float] = None
    image_count: int = Field(0, description="Number of images")
    item_count: int = Field(0, description="Number of extracted items")
    matched_count: int = Field(0, description="Number of matched items")
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiptsResponse(BaseModel):
    """Schema for list of receipts response"""
    receipts: List[ReceiptSummary]
    total: int


# Reconciliation Schemas

class ReconciliationResult(BaseModel):
    """Result of reconciling a single receipt item"""
    receipt_item_id: UUID
    shopping_list_item_id: Optional[UUID] = None
    match_status: ReceiptItemMatchStatusEnum
    confidence: float = Field(ge=0, le=100)
    matched_name: Optional[str] = None


class ReconciliationSummary(BaseModel):
    """Summary of reconciliation results"""
    total_receipt_items: int
    total_shopping_items: int
    matched_count: int
    suggested_count: int
    extra_count: int
    missing_count: int
    match_rate: float = Field(ge=0, le=100, description="Percentage of shopping items matched")


class ReconciliationResponse(BaseModel):
    """Response from reconciliation endpoint"""
    receipt_id: UUID
    results: List[ReconciliationResult]
    summary: ReconciliationSummary
    missing_items: List[dict] = Field(default=[], description="Shopping list items not found on receipt")


# Shopping List Item Status

class ShoppingListItemMatch(BaseModel):
    """Shopping list item with match info"""
    id: UUID
    name: str
    quantity: int
    unit: Optional[str] = None
    matched: bool = False
    matched_receipt_item_id: Optional[UUID] = None
    match_confidence: Optional[float] = None


class AddExtraToListRequest(BaseModel):
    """Request to add extra items to shopping list"""
    receipt_item_ids: List[UUID] = Field(..., min_length=1, description="Receipt item IDs to add")
