"""
Shopping List Models
Manages shopping lists with support for Grocy product integration.

Features:
- Multiple lists per house
- Items can be linked to Grocy products or free text
- Status tracking (active, completed, cancelled)
- Barcode scanning support for load verification
"""

from sqlalchemy import Column, String, ForeignKey, Integer, Boolean, Enum as SQLEnum, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class ShoppingListStatus(str, enum.Enum):
    """Shopping list status values"""
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class VerificationStatus(str, enum.Enum):
    """Load verification status values"""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"


class ShoppingList(BaseModel):
    """
    Shopping List Model

    Represents a shopping list for a house with multiple items.
    Lists can be created, completed, or cancelled.
    """
    __tablename__ = "shopping_lists"

    # House ownership
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Creator
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Store where shopping is done (for store-specific ordering)
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # List name (e.g., "Lista del 25/01/2026")
    name = Column(String(255), nullable=False)

    # Status
    status = Column(
        SQLEnum(ShoppingListStatus),
        default=ShoppingListStatus.ACTIVE,
        nullable=False,
        index=True
    )

    # Editing lock - tracks who is currently editing
    editing_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    editing_since = Column(DateTime(timezone=True), nullable=True)

    # Load verification status
    verification_status = Column(
        SQLEnum(VerificationStatus),
        default=VerificationStatus.NOT_STARTED,
        nullable=False
    )

    # Relationships
    house = relationship("House", back_populates="shopping_lists")
    creator = relationship("User", foreign_keys=[created_by])
    store = relationship("Store", back_populates="shopping_lists")
    editor = relationship("User", foreign_keys=[editing_by])
    items = relationship(
        "ShoppingListItem",
        back_populates="shopping_list",
        cascade="all, delete-orphan",
        order_by="ShoppingListItem.position"
    )

    def __repr__(self):
        return f"<ShoppingList(id={self.id}, name='{self.name}', status={self.status})>"


class ShoppingListItem(BaseModel):
    """
    Shopping List Item Model

    Represents a single item in a shopping list.
    Can be linked to a Grocy product or be free text.
    """
    __tablename__ = "shopping_list_items"

    # Parent list
    shopping_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Item position in list (for ordering)
    position = Column(Integer, default=0, nullable=False)

    # Item name (free text or from Grocy)
    name = Column(String(255), nullable=False)

    # Optional Grocy product link
    grocy_product_id = Column(Integer, nullable=True)
    grocy_product_name = Column(String(255), nullable=True)

    # Quantity (optional) - can be integer for pieces or float for weight
    quantity = Column(Integer, default=1, nullable=False)  # Store as int, frontend handles decimals for weight
    unit = Column(String(50), nullable=True)  # 'pz' for pieces, 'kg' for weight

    # Checked/purchased status
    checked = Column(Boolean, default=False, nullable=False)
    checked_at = Column(DateTime(timezone=True), nullable=True)  # When item was checked (for store ordering)

    # Barcode scanned during load check
    scanned_barcode = Column(String(100), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)  # When item was verified via barcode
    verified_quantity = Column(Float, nullable=True)  # Quantity confirmed during verification
    verified_unit = Column(String(50), nullable=True)  # Unit confirmed during verification ('pz' or 'kg')

    # Not purchased status (item wasn't available at store)
    not_purchased = Column(Boolean, default=False, nullable=False)
    not_purchased_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship
    shopping_list = relationship("ShoppingList", back_populates="items")

    def __repr__(self):
        return f"<ShoppingListItem(id={self.id}, name='{self.name}', checked={self.checked})>"
