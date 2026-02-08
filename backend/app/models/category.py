"""
Category Model
Represents product categories for shopping list items.
Each house has its own categories. Categories with house_id=null are global templates.
"""

from sqlalchemy import Column, String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Category(BaseModel):
    """
    Category Model

    Represents a product category (e.g., "Food", "No Food", "Chemicals", "Pet Food").
    Each house has its own categories. house_id=null means global template.
    """
    __tablename__ = "categories"

    # House this category belongs to (null = global template)
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="House this category belongs to (null = global template)"
    )

    # Category name (e.g., "Food", "No Food", "Chemicals", "Pet Food")
    # Unique constraint removed - same name can exist in different houses
    name = Column(String(100), nullable=False, index=True)

    # Optional description
    description = Column(String(500), nullable=True)

    # Icon or emoji for display (optional)
    icon = Column(String(50), nullable=True)

    # Color for display (hex code, optional)
    color = Column(String(7), nullable=True)  # e.g., "#FF5733"

    # Sort order for display
    sort_order = Column(Integer, default=0, nullable=False)

    # Who created this category
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"
