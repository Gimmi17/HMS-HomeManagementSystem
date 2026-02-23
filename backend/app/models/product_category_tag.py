"""
Product Category Tag Model
Normalized categories for products from Open Food Facts.

Categories can be hierarchical (e.g., "en:beverages" > "en:carbonated-drinks" > "en:sodas").
Each product can have multiple category tags.
"""

from sqlalchemy import Column, String, Text, ForeignKey, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


# Association table for many-to-many relationship
product_category_association = Table(
    'product_category_associations',
    BaseModel.metadata,
    Column('product_id', UUID(as_uuid=True), ForeignKey('product_catalog.id', ondelete='CASCADE'), primary_key=True),
    Column('category_tag_id', UUID(as_uuid=True), ForeignKey('product_category_tags.id', ondelete='CASCADE'), primary_key=True)
)


class ProductCategoryTag(BaseModel):
    """
    Product Category Tag Model

    Stores unique category tags from Open Food Facts.
    Categories use the format "lang:category-name" (e.g., "en:beverages", "it:bevande").
    """
    __tablename__ = "product_category_tags"

    # Category identifier (e.g., "en:beverages", "it:bevande-gassate")
    tag_id = Column(String(255), nullable=False, unique=True, index=True)

    # Human-readable name (e.g., "Beverages", "Bevande gassate")
    name = Column(String(255), nullable=True)

    # Language code (e.g., "en", "it", "fr")
    lang = Column(String(10), nullable=True, index=True)

    # Parent category for hierarchy (optional)
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_category_tags.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Default environment for this category (auto-assign when sending to dispensa)
    default_environment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Relationships
    default_environment = relationship("Environment")
    parent = relationship("ProductCategoryTag", remote_side="ProductCategoryTag.id", backref="children")
    products = relationship(
        "ProductCatalog",
        secondary=product_category_association,
        back_populates="category_tags"
    )

    def __repr__(self):
        return f"<ProductCategoryTag(tag_id={self.tag_id}, name='{self.name}')>"
