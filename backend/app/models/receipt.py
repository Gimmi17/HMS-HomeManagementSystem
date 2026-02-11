"""
Receipt Models
OCR-based receipt scanning and reconciliation with shopping lists.

Features:
- Upload receipt images
- Extract items via PaddleOCR
- Match extracted items with shopping list
- Track reconciliation status
"""

from sqlalchemy import Column, String, ForeignKey, Integer, Boolean, Enum as SQLEnum, DateTime, Float, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class ReceiptStatus(str, enum.Enum):
    """Receipt processing status"""
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    RECONCILED = "reconciled"
    ERROR = "error"


class ReceiptItemMatchStatus(str, enum.Enum):
    """Match status for receipt items against shopping list"""
    UNMATCHED = "unmatched"
    MATCHED = "matched"
    EXTRA = "extra"
    IGNORED = "ignored"


class ReceiptImage(BaseModel):
    """
    Receipt Image Model

    Represents a single image of a receipt.
    Multiple images can be uploaded for long receipts.
    """
    __tablename__ = "receipt_images"

    # Parent receipt
    receipt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Image order (0 = top of receipt, 1 = next section, etc.)
    position = Column(Integer, default=0, nullable=False)

    # Image storage path (relative to data/receipts/)
    image_path = Column(String(500), nullable=False)

    # OCR results for this specific image
    raw_ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)

    # Relationship
    receipt = relationship("Receipt", back_populates="images")

    def __repr__(self):
        return f"<ReceiptImage(id={self.id}, position={self.position}, receipt_id={self.receipt_id})>"


class Receipt(BaseModel):
    """
    Receipt Model

    Represents an uploaded receipt linked to a shopping list.
    Supports multiple images for long receipts.
    Stores combined OCR results and reconciliation status.
    """
    __tablename__ = "receipts"

    # Link to shopping list
    shopping_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # User who uploaded
    uploaded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Processing status
    status = Column(
        SQLEnum(ReceiptStatus),
        default=ReceiptStatus.UPLOADED,
        nullable=False,
        index=True
    )

    # OCR Results
    raw_ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)

    # Detected store info (if available)
    store_name_detected = Column(String(255), nullable=True)

    # Detected total amount
    total_amount_detected = Column(Float, nullable=True)

    # Processing timestamps
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Error message if processing failed
    error_message = Column(Text, nullable=True)

    # Relationships
    shopping_list = relationship("ShoppingList", back_populates="receipts")
    uploader = relationship("User", foreign_keys=[uploaded_by])
    images = relationship(
        "ReceiptImage",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptImage.position"
    )
    items = relationship(
        "ReceiptItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="ReceiptItem.position"
    )

    def __repr__(self):
        return f"<Receipt(id={self.id}, status={self.status}, shopping_list_id={self.shopping_list_id})>"


class ReceiptItem(BaseModel):
    """
    Receipt Item Model

    Represents a single item extracted from a receipt via OCR.
    Can be matched to shopping list items or marked as extra.
    """
    __tablename__ = "receipt_items"

    # Parent receipt
    receipt_id = Column(
        UUID(as_uuid=True),
        ForeignKey("receipts.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Position in receipt (line order)
    position = Column(Integer, default=0, nullable=False)

    # Raw text as extracted from OCR
    raw_text = Column(String(500), nullable=False)

    # Parsed/cleaned item name
    parsed_name = Column(String(255), nullable=True)

    # Parsed quantity (e.g., 2 for "2x", 0.8 for "KG 0,800")
    parsed_quantity = Column(Float, nullable=True)

    # Parsed unit price (per item or per kg)
    parsed_unit_price = Column(Float, nullable=True)

    # Total price for this line
    parsed_total_price = Column(Float, nullable=True)

    # Match status against shopping list
    match_status = Column(
        SQLEnum(ReceiptItemMatchStatus),
        default=ReceiptItemMatchStatus.UNMATCHED,
        nullable=False,
        index=True
    )

    # Link to matched shopping list item (if matched)
    shopping_list_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_list_items.id", ondelete="SET NULL"),
        nullable=True
    )

    # User corrections
    user_corrected_name = Column(String(255), nullable=True)
    user_confirmed = Column(Boolean, default=False, nullable=False)

    # Match confidence score (0-100)
    match_confidence = Column(Float, nullable=True)

    # Relationship
    receipt = relationship("Receipt", back_populates="items")
    shopping_list_item = relationship("ShoppingListItem")

    def __repr__(self):
        return f"<ReceiptItem(id={self.id}, raw_text='{self.raw_text[:30]}...', match_status={self.match_status})>"
