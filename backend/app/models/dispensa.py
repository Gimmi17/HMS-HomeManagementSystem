"""
Dispensa Model
Manages pantry items post-verification from shopping lists.

Features:
- Tracks products with quantity, unit, expiry date
- Links to shopping list source and categories
- Consumption tracking (total/partial)
- Duplicate merging by name+unit
"""

from sqlalchemy import Column, String, ForeignKey, Boolean, Float, DateTime, Date, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class DispensaItem(BaseModel):
    """
    Dispensa Item Model

    Represents a product in the household pantry.
    Items can be added manually or sent from verified shopping lists.
    """
    __tablename__ = "dispensa_items"

    # House ownership
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Product info
    name = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), nullable=True)  # pz, kg, g, l, ml

    # Category
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Expiry tracking
    expiry_date = Column(Date, nullable=True)

    # Barcode
    barcode = Column(String(100), nullable=True)

    # Grocy product link
    grocy_product_id = Column(Integer, nullable=True)
    grocy_product_name = Column(String(255), nullable=True)

    # Source shopping list
    source_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_lists.id", ondelete="SET NULL"),
        nullable=True
    )

    # Source shopping list item (for individual stock tracking and sync)
    source_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_list_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Who added it
    added_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Consumption tracking
    is_consumed = Column(Boolean, default=False, nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)

    # Notes
    notes = Column(String(500), nullable=True)

    # Relationships
    house = relationship("House")
    category = relationship("Category")
    source_list = relationship("ShoppingList")
    source_item = relationship("ShoppingListItem", foreign_keys=[source_item_id])
    added_by_user = relationship("User")

    def __repr__(self):
        return f"<DispensaItem(id={self.id}, name='{self.name}', qty={self.quantity})>"
