"""
Product Catalog Model
Local cache of product data from Open Food Facts and other sources.

Stores product information for faster lookups and offline access.
"""

from sqlalchemy import Column, String, Text, Float, JSON
from app.models.base import BaseModel


class ProductCatalog(BaseModel):
    """
    Product Catalog Model

    Local cache of product data scanned during load verification.
    Data is enriched from Open Food Facts API.
    """
    __tablename__ = "product_catalog"

    # Primary identifier - barcode
    barcode = Column(String(100), unique=True, nullable=False, index=True)

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

    def __repr__(self):
        return f"<ProductCatalog(barcode={self.barcode}, name='{self.name}')>"
