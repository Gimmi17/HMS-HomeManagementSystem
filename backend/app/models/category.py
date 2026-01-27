"""
Category Model
Represents product categories for shopping list items.
Categories are shared across all houses.
"""

from sqlalchemy import Column, String, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Category(BaseModel):
    """
    Category Model

    Represents a product category (e.g., "Food", "No Food", "Chemicals", "Pet Food").
    Shared across all houses - anyone can create and use categories.
    """
    __tablename__ = "categories"

    # Category name (e.g., "Food", "No Food", "Chemicals", "Pet Food")
    name = Column(String(100), nullable=False, unique=True, index=True)

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
