"""
Recipe Model
Represents recipes created and stored in the meal planner system.

Each recipe contains:
- Basic information (name, description, procedure)
- List of ingredients with quantities (stored in JSONB for flexibility)
- Preparation metadata (time, difficulty, tags)
- Pre-calculated nutritional values (computed at save time from ingredients)

Recipes belong to a house and can be used by all house members.
The creator is tracked but all members can view and use the recipe.

Ingredients are stored as JSONB to allow flexible schema without migrations:
[
    {
        "food_id": "uuid-of-food",
        "food_name": "Pollo",
        "quantity_g": 200.0
    },
    {
        "food_id": "uuid-of-food",
        "food_name": "Pasta",
        "quantity_g": 100.0
    }
]

Nutritional values are calculated when recipe is created/updated by:
1. Looking up each ingredient's food in the foods table
2. Scaling nutrients from 100g to actual quantity_g
3. Summing all ingredient nutrients to get recipe totals
"""

from sqlalchemy import Column, String, Text, Integer, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Recipe(BaseModel):
    """
    Recipe model for storing user-created recipes.

    Fields:
        id (UUID): Primary key, inherited from BaseModel
        house_id (UUID): House this recipe belongs to
        created_by (UUID): User who created the recipe
        name (str): Recipe name (e.g., "Pasta al Pomodoro")
        description (str): Short description of the recipe
        procedure (str): Step-by-step cooking instructions
        ingredients (list[dict]): JSONB array of ingredients with quantities
        preparation_time_min (int): Time needed to prepare in minutes
        difficulty (str): Difficulty level (easy, medium, hard)
        tags (list[str]): Tags for categorization (e.g., ["veloce", "vegetariano"])
        total_calories (Decimal): Total calories for entire recipe
        total_proteins_g (Decimal): Total protein in grams
        total_fats_g (Decimal): Total fat in grams
        total_carbs_g (Decimal): Total carbohydrates in grams
        created_at (datetime): Recipe creation timestamp
        updated_at (datetime): Last recipe update timestamp

    Relationships:
        house: Many-to-one with House (future)
        creator: Many-to-one with User (future)
        meals: One-to-many with Meal (meals created from this recipe)

    Ingredients JSONB structure:
        [
            {
                "food_id": "uuid-string",  # References foods.id
                "food_name": "Pollo petto",  # Cached for display
                "quantity_g": 200.0  # Quantity in grams
            },
            ...
        ]

    Tags array examples:
        ["veloce", "leggero", "vegetariano", "comfort", "estivo"]

    Example usage:
        recipe = Recipe(
            house_id=house.id,
            created_by=user.id,
            name="Pasta al Pomodoro",
            description="Classic Italian pasta with tomato sauce",
            procedure="1. Boil water\\n2. Cook pasta\\n3. Add sauce",
            ingredients=[
                {"food_id": "...", "food_name": "Pasta", "quantity_g": 100},
                {"food_id": "...", "food_name": "Pomodori", "quantity_g": 200}
            ],
            preparation_time_min=20,
            difficulty="easy",
            tags=["veloce", "vegetariano"],
            total_calories=350.0,  # Calculated automatically
            total_proteins_g=12.0,
            total_fats_g=2.5,
            total_carbs_g=70.0
        )
        db.add(recipe)
        db.commit()
    """

    __tablename__ = "recipes"

    # Ownership and Multi-tenancy
    # ----------------------------
    # House this recipe belongs to
    # All members of the house can view and use this recipe
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="House that owns this recipe"
    )

    # User who created the recipe
    # Used for attribution but not for access control
    # (all house members can use any house recipe)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,  # Allow null if user is deleted
        comment="User who created this recipe"
    )

    # Basic Recipe Information
    # ------------------------
    # Recipe name (e.g., "Pasta al Pomodoro", "Chicken Curry")
    # Must be provided, indexed for search
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Recipe name"
    )

    # Short description of the recipe
    # Optional, used in recipe listings and search
    description = Column(
        Text,
        nullable=True,
        comment="Short recipe description"
    )

    # Step-by-step cooking procedure
    # Can be formatted with newlines, markdown, etc.
    # Optional but recommended
    procedure = Column(
        Text,
        nullable=True,
        comment="Cooking instructions"
    )

    # Ingredients and Quantities
    # --------------------------
    # JSONB array of ingredients with their quantities
    # Format: [{"food_id": "uuid", "food_name": "Name", "quantity_g": 200.0}, ...]
    # JSONB provides flexibility and allows efficient queries
    # Must have at least one ingredient (validated at service layer)
    ingredients = Column(
        JSONB,
        nullable=False,
        default=[],
        comment="Array of ingredients with quantities"
    )

    # Recipe Metadata
    # ---------------
    # Time needed to prepare in minutes
    # Used for filtering and meal planning
    preparation_time_min = Column(
        Integer,
        nullable=True,
        comment="Preparation time in minutes"
    )

    # Difficulty level: easy, medium, hard
    # Used for filtering and user skill matching
    difficulty = Column(
        String(50),
        nullable=True,
        comment="Difficulty level (easy, medium, hard)"
    )

    # Tags for categorization and filtering
    # JSONB array allows flexible tagging
    # Examples: ["veloce", "leggero", "vegetariano", "comfort"]
    tags = Column(
        JSONB,
        nullable=False,
        default=[],
        comment="Recipe tags for categorization"
    )

    # Calculated Nutritional Values
    # ------------------------------
    # These fields are computed automatically when recipe is created/updated
    # They are the SUM of all ingredient nutrients scaled by quantity
    #
    # Calculation formula:
    #   For each ingredient:
    #     nutrient_amount = (food.nutrient_per_100g * ingredient.quantity_g) / 100
    #   total_nutrient = SUM(all ingredient nutrient_amounts)

    # Total calories for the entire recipe
    # Sum of all ingredient calories
    total_calories = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total calories for entire recipe"
    )

    # Total protein in grams for the entire recipe
    total_proteins_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total protein in grams"
    )

    # Total fat in grams for the entire recipe
    total_fats_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total fat in grams"
    )

    # Total carbohydrates in grams for the entire recipe
    total_carbs_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total carbohydrates in grams"
    )

    # Relationships
    # -------------
    # These will be uncommented when House model is available
    # house = relationship("House", back_populates="recipes")
    # creator = relationship("User", foreign_keys=[created_by])
    # meals = relationship("Meal", back_populates="recipe", cascade="all, delete-orphan")

    def __repr__(self):
        """String representation for debugging."""
        return f"<Recipe(id={self.id}, name='{self.name}', house_id={self.house_id})>"

    @property
    def ingredient_count(self) -> int:
        """Get the number of ingredients in this recipe."""
        return len(self.ingredients) if self.ingredients else 0

    @property
    def is_vegetarian(self) -> bool:
        """Check if recipe is tagged as vegetarian."""
        return "vegetariano" in (self.tags or []) or "vegan" in (self.tags or [])

    @property
    def is_quick(self) -> bool:
        """Check if recipe is quick to prepare (< 30 minutes)."""
        return self.preparation_time_min is not None and self.preparation_time_min < 30


# Database Indexes
# ----------------
# Composite index for house-based queries with filtering
# Speeds up: SELECT * FROM recipes WHERE house_id = ? AND difficulty = ?
Index(
    'idx_recipes_house_difficulty',
    Recipe.house_id,
    Recipe.difficulty
)

# Index for tag-based searches
# JSONB GIN index allows efficient tag filtering
# Speeds up: SELECT * FROM recipes WHERE tags @> '["vegetariano"]'
Index(
    'idx_recipes_tags',
    Recipe.tags,
    postgresql_using='gin'
)

# Index for name search (already created via index=True on name column)
# Index for house_id (already created via index=True on house_id column)
