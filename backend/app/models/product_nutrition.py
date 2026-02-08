"""
Product Nutrition Model
Detailed nutritional data for products from external APIs (Open Food Facts, etc.)

This is an intermediate table between ProductCatalog and Food:
- ProductCatalog: basic product info (barcode, name, brand)
- ProductNutrition: detailed nutritional data from APIs (THIS TABLE)
- Food: generic food nutritional data (from local database)

When a barcode is scanned and found in external APIs, the nutritional
data is stored here for future reference and calculations.
"""

from sqlalchemy import Column, String, Text, Float, Integer, JSON, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base import BaseModel


class ProductNutrition(BaseModel):
    """
    Product Nutrition Model

    Stores detailed nutritional information fetched from external APIs.
    Linked to ProductCatalog via product_id.
    """
    __tablename__ = "product_nutrition"

    # ============================================================
    # RELATIONSHIPS
    # ============================================================

    # Link to ProductCatalog
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_catalog.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One nutrition record per product
        index=True,
        comment="Link to product_catalog"
    )

    product = relationship("ProductCatalog", backref="nutrition")

    # ============================================================
    # PRODUCT INFO (from API)
    # ============================================================

    # Product details
    product_name = Column(String(500), nullable=True)
    brands = Column(String(500), nullable=True)
    quantity = Column(String(100), nullable=True)  # e.g. "1000g", "330 ml"
    serving_size = Column(String(100), nullable=True)  # e.g. "80 g"

    # Categories and ingredients
    categories = Column(Text, nullable=True)  # Comma-separated
    ingredients_text = Column(Text, nullable=True)  # Full ingredients list

    # Allergens and traces
    allergens = Column(Text, nullable=True)  # e.g. "en:gluten"
    traces = Column(Text, nullable=True)  # e.g. "en:eggs,en:soybeans"

    # Labels and certifications
    labels = Column(Text, nullable=True)  # e.g. "Prodotto in Italia, Végétarien"
    origins = Column(Text, nullable=True)  # Origin of ingredients

    # Packaging
    packaging = Column(Text, nullable=True)

    # ============================================================
    # SCORES
    # ============================================================

    nutriscore_grade = Column(String(1), nullable=True)  # a, b, c, d, e
    ecoscore_grade = Column(String(10), nullable=True)  # a, b, c, d, e or "not-applicable"
    nova_group = Column(Integer, nullable=True)  # 1, 2, 3, 4
    nutrition_score_fr = Column(Integer, nullable=True)  # French nutrition score

    # ============================================================
    # BASIC NUTRIENTS (per 100g)
    # ============================================================

    energy_kcal = Column(Float, nullable=True)
    energy_kj = Column(Float, nullable=True)

    fat = Column(Float, nullable=True)
    saturated_fat = Column(Float, nullable=True)

    carbohydrates = Column(Float, nullable=True)
    sugars = Column(Float, nullable=True)
    added_sugars = Column(Float, nullable=True)
    starch = Column(Float, nullable=True)

    fiber = Column(Float, nullable=True)
    proteins = Column(Float, nullable=True)

    salt = Column(Float, nullable=True)
    sodium = Column(Float, nullable=True)

    # ============================================================
    # MINERALS (per 100g, in mg unless specified)
    # ============================================================

    calcium = Column(Float, nullable=True)  # mg
    iron = Column(Float, nullable=True)  # mg
    magnesium = Column(Float, nullable=True)  # mg
    manganese = Column(Float, nullable=True)  # mg
    phosphorus = Column(Float, nullable=True)  # mg
    potassium = Column(Float, nullable=True)  # mg
    copper = Column(Float, nullable=True)  # mg
    selenium = Column(Float, nullable=True)  # mcg
    zinc = Column(Float, nullable=True)  # mg

    # ============================================================
    # VITAMINS (per 100g)
    # ============================================================

    vitamin_a = Column(Float, nullable=True)  # mcg
    vitamin_b1 = Column(Float, nullable=True)  # mg (thiamin)
    vitamin_b2 = Column(Float, nullable=True)  # mg (riboflavin)
    vitamin_b6 = Column(Float, nullable=True)  # mg
    vitamin_b9 = Column(Float, nullable=True)  # mcg (folate)
    vitamin_b12 = Column(Float, nullable=True)  # mcg
    vitamin_c = Column(Float, nullable=True)  # mg
    vitamin_d = Column(Float, nullable=True)  # mcg
    vitamin_e = Column(Float, nullable=True)  # mg
    vitamin_k = Column(Float, nullable=True)  # mcg

    # ============================================================
    # OTHER
    # ============================================================

    caffeine = Column(Float, nullable=True)  # mg
    choline = Column(Float, nullable=True)  # mg
    fruits_vegetables_nuts = Column(Float, nullable=True)  # percentage

    # ============================================================
    # RAW DATA & METADATA
    # ============================================================

    # Store the complete nutriments object from API for future use
    raw_nutriments = Column(JSON, nullable=True)

    # Store complete API response for debugging/future fields
    raw_api_response = Column(JSON, nullable=True)

    # Source tracking
    source = Column(String(50), default="openfoodfacts")  # openfoodfacts, manual, etc.
    fetched_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ProductNutrition(product_id={self.product_id}, name='{self.product_name}')>"
