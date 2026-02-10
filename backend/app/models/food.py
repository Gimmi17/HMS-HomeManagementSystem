"""
Food Model
Stores nutritional information for foods.

Each house has its own foods database. Foods with house_id=null are global templates
imported from nutrizione_pulito.csv.
All values are per 100g of food.

Usage:
    - Search foods by name or category for recipe ingredients
    - Calculate nutritional values for recipes and meals
    - Autocomplete suggestions in frontend forms
"""

from sqlalchemy import Column, String, Numeric, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Food(BaseModel):
    """
    Food nutritional database model.

    All nutritional values are stored per 100g of food to enable precise calculations
    when users add ingredients with custom quantities (e.g., 150g of chicken).

    Each house has its own foods. house_id=null means global template.

    The calculation formula for actual nutrients is:
        actual_nutrient = (food.nutrient_per_100g * quantity_grams) / 100

    Example:
        If a food has 20g protein per 100g, and user adds 150g:
        actual_protein = (20 * 150) / 100 = 30g protein
    """

    __tablename__ = "foods"

    # House this food belongs to (null = global template)
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="House this food belongs to (null = global template)"
    )

    # Basic Information
    # -----------------
    # Name of the food (e.g., "Pollo", "Pasta", "Mele")
    # Same name can exist in different houses
    # Indexed for fast search queries (autocomplete)
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Food name (e.g., 'Pollo', 'Pasta')"
    )

    # Category classification (e.g., "Carne", "Frutta", "Verdura", "Cereali")
    # Indexed for category filtering in search queries
    # Used to filter foods by type in autocomplete
    category = Column(
        String(100),
        index=True,
        nullable=True,
        comment="Food category (e.g., 'Carne', 'Verdura', 'Frutta')"
    )

    # Macronutrients (per 100g)
    # -------------------------
    # These are the primary nutrients tracked for meal planning

    # Protein content in grams per 100g
    # Essential for muscle building and repair
    proteins_g = Column(
        Numeric(8, 2),
        nullable=True,
        comment="Protein content in grams per 100g"
    )

    # Fat content in grams per 100g
    # Important for energy and hormone production
    fats_g = Column(
        Numeric(8, 2),
        nullable=True,
        comment="Total fat content in grams per 100g"
    )

    # Carbohydrate content in grams per 100g
    # Primary energy source for the body
    carbs_g = Column(
        Numeric(8, 2),
        nullable=True,
        comment="Carbohydrate content in grams per 100g"
    )

    # Fiber content in grams per 100g
    # Important for digestive health
    fibers_g = Column(
        Numeric(8, 2),
        nullable=True,
        comment="Dietary fiber in grams per 100g"
    )

    # Essential Fatty Acids (per 100g)
    # --------------------------------
    # Omega-3 ALA (Alpha-linolenic acid) in grams per 100g
    # Important for heart and brain health
    omega3_ala_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Omega-3 (ALA) content in grams per 100g"
    )

    # Omega-6 fatty acids in grams per 100g
    # Essential fatty acid, but balance with omega-3 is important
    omega6_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Omega-6 content in grams per 100g"
    )

    # Minerals (per 100g)
    # -------------------
    # Values stored in grams, converted from CSV (which may have mg/mcg)

    # Calcium in grams per 100g
    # Essential for bone health and muscle function
    calcium_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Calcium content in grams per 100g"
    )

    # Iron in grams per 100g
    # Essential for oxygen transport in blood
    iron_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Iron content in grams per 100g"
    )

    # Magnesium in grams per 100g
    # Important for muscle and nerve function
    magnesium_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Magnesium content in grams per 100g"
    )

    # Potassium in grams per 100g
    # Essential for heart and muscle function
    potassium_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Potassium content in grams per 100g"
    )

    # Zinc in grams per 100g
    # Important for immune function and wound healing
    zinc_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Zinc content in grams per 100g"
    )

    # Vitamins (per 100g)
    # -------------------
    # Values stored in grams, converted from CSV (which may have mg/mcg)

    # Vitamin A in grams per 100g
    # Important for vision and immune function
    vitamin_a_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin A content in grams per 100g"
    )

    # Vitamin C in grams per 100g
    # Antioxidant, important for immune function
    vitamin_c_g = Column(
        Numeric(8, 4),
        nullable=True,
        comment="Vitamin C content in grams per 100g"
    )

    # Vitamin D in grams per 100g
    # Important for bone health and immune function
    vitamin_d_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin D content in grams per 100g"
    )

    # Vitamin E in grams per 100g
    # Antioxidant, protects cells from damage
    vitamin_e_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin E content in grams per 100g"
    )

    # Vitamin K in grams per 100g
    # Important for blood clotting and bone health
    vitamin_k_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin K content in grams per 100g"
    )

    # Vitamin B6 in grams per 100g
    # Important for brain development and immune function
    vitamin_b6_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin B6 content in grams per 100g"
    )

    # Folate (Vitamin B9) in grams per 100g
    # Essential for DNA synthesis and cell division
    folate_b9_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Folate (B9) content in grams per 100g"
    )

    # Vitamin B12 in grams per 100g
    # Essential for nerve function and red blood cell production
    vitamin_b12_g = Column(
        Numeric(8, 6),
        nullable=True,
        comment="Vitamin B12 content in grams per 100g"
    )

    def __repr__(self):
        """String representation for debugging."""
        return f"<Food(name='{self.name}', category='{self.category}')>"


# Database Indexes
# ----------------
# Additional composite indexes for optimized query performance

# Index for combined name search with category filtering
# Speeds up queries like: SELECT * FROM foods WHERE name ILIKE '%pollo%' AND category = 'Carne'
Index(
    'idx_foods_name_category',
    Food.name,
    Food.category
)

# Index for category-only queries
# Already created via index=True on category column, but explicitly defined here for clarity
Index(
    'idx_foods_category',
    Food.category
)
