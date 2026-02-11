"""
Product Catalog Model
Local cache of product data from Open Food Facts and other sources.

Each house has its own product catalog. Products with house_id=null are global templates.
Stores product information for faster lookups and offline access.
"""

from sqlalchemy import Column, String, Text, Float, JSON, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel
from app.models.product_category_tag import product_category_association


class ProductCatalog(BaseModel):
    """
    Product Catalog Model

    Local cache of product data scanned during load verification.
    Data is enriched from Open Food Facts API.
    Each house has its own products. house_id=null means global template.
    """
    __tablename__ = "product_catalog"

    # House this product belongs to (null = global template)
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="House this product belongs to (null = global template)"
    )

    # Primary identifier - barcode (same barcode can exist in different houses)
    barcode = Column(String(100), nullable=False, index=True)

    # Basic info
    name = Column(String(255), nullable=True)
    brand = Column(String(255), nullable=True)

    # Quantity/packaging info
    quantity_text = Column(String(100), nullable=True)  # e.g. "500g", "6 x 330ml"

    # Categories
    categories = Column(Text, nullable=True)  # Comma-separated

    # Nutritional data (per 100g)
    energy_kcal = Column(Float, nullable=True)
    proteins_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    sugars_g = Column(Float, nullable=True)
    fats_g = Column(Float, nullable=True)
    saturated_fats_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)
    salt_g = Column(Float, nullable=True)

    # Scores
    nutriscore = Column(String(1), nullable=True)  # A, B, C, D, E
    ecoscore = Column(String(1), nullable=True)
    nova_group = Column(String(1), nullable=True)  # 1, 2, 3, 4

    # Images
    image_url = Column(Text, nullable=True)
    image_small_url = Column(Text, nullable=True)

    # Source tracking
    source = Column(String(50), default="openfoodfacts")  # openfoodfacts, manual, grocy

    # Raw data from API (for future use)
    raw_data = Column(JSON, nullable=True)

    # Local category (assigned by user during load verification)
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Local category assigned by user"
    )

    # Soft delete flag
    cancelled = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    category = relationship("Category")
    category_tags = relationship(
        "ProductCategoryTag",
        secondary=product_category_association,
        back_populates="products"
    )

    def __repr__(self):
        return f"<ProductCatalog(barcode={self.barcode}, name='{self.name}')>"
