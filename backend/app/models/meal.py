"""
Meal Model
Represents consumed meals tracked in the meal planner system.

Each meal record represents food that was actually eaten by a user.
Meals can be created in two ways:

1. From a Recipe: User selects an existing recipe and records it as consumed
   - meal.recipe_id is set
   - meal.ingredients is NULL (inherited from recipe)
   - Nutrients can be adjusted if portion size differs from full recipe

2. Free Meal: User manually enters ingredients without saving as a recipe
   - meal.recipe_id is NULL
   - meal.ingredients contains the ingredient list
   - Nutrients are calculated from ingredients

All meals track:
- Who consumed it (user_id)
- When it was consumed (consumed_at)
- What type of meal (colazione, spuntino, pranzo, cena)
- Nutritional values (calories, macros)
- Optional notes

This allows for:
- Nutritional tracking per user
- Meal history analysis
- Daily/weekly calorie and macro summaries
- Health correlation analysis
"""

from sqlalchemy import Column, String, Text, Numeric, ForeignKey, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Meal(BaseModel):
    """
    Meal model for tracking consumed food.

    Fields:
        id (UUID): Primary key, inherited from BaseModel
        user_id (UUID): User who consumed this meal
        house_id (UUID): House the user belongs to (for multi-tenancy)
        recipe_id (UUID): Optional reference to recipe if meal was from recipe
        meal_type (str): Type of meal (colazione, spuntino, pranzo, cena)
        ingredients (list[dict]): JSONB ingredients if free meal (NULL if from recipe)
        quantity_grams (Decimal): Total quantity consumed in grams
        calories (Decimal): Total calories consumed
        proteins_g (Decimal): Total protein consumed in grams
        fats_g (Decimal): Total fat consumed in grams
        carbs_g (Decimal): Total carbohydrates consumed in grams
        consumed_at (datetime): When the meal was consumed
        notes (str): Optional notes about the meal
        created_at (datetime): Record creation timestamp
        updated_at (datetime): Last update timestamp

    Relationships:
        user: Many-to-one with User
        house: Many-to-one with House
        recipe: Many-to-one with Recipe (optional)

    Ingredients JSONB structure (for free meals only):
        [
            {
                "food_id": "uuid-string",
                "food_name": "Pollo petto",
                "quantity_g": 150.0
            },
            ...
        ]

    Meal Types:
        - "colazione" (breakfast)
        - "spuntino" (snack)
        - "pranzo" (lunch)
        - "cena" (dinner)

    Example usage (from recipe):
        meal = Meal(
            user_id=user.id,
            house_id=house.id,
            recipe_id=recipe.id,
            meal_type="pranzo",
            quantity_grams=300.0,
            calories=recipe.total_calories,
            proteins_g=recipe.total_proteins_g,
            fats_g=recipe.total_fats_g,
            carbs_g=recipe.total_carbs_g,
            consumed_at=datetime.now(),
            notes="Delicious!"
        )

    Example usage (free meal):
        meal = Meal(
            user_id=user.id,
            house_id=house.id,
            recipe_id=None,  # No recipe
            meal_type="cena",
            ingredients=[
                {"food_id": "...", "food_name": "Pollo", "quantity_g": 150},
                {"food_id": "...", "food_name": "Riso", "quantity_g": 80}
            ],
            quantity_grams=230.0,
            calories=450.0,  # Calculated from ingredients
            proteins_g=35.0,
            fats_g=8.0,
            carbs_g=62.0,
            consumed_at=datetime.now()
        )
    """

    __tablename__ = "meals"

    # User and Multi-tenancy
    # ----------------------
    # User who consumed this meal
    # Critical for per-user nutritional tracking
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User who consumed this meal"
    )

    # House the user belongs to
    # Required for multi-tenant data isolation
    # Even though user_id implies house, we store it for efficient queries
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="House the user belongs to"
    )

    # Recipe Reference (Optional)
    # ---------------------------
    # If meal was created from a recipe, this links to it
    # NULL if meal was entered manually (free meal)
    # SET NULL on delete so meal record remains even if recipe is deleted
    recipe_id = Column(
        UUID(as_uuid=True),
        ForeignKey("recipes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Recipe this meal was made from (NULL if free meal)"
    )

    # Meal Classification
    # -------------------
    # Type of meal consumed
    # Values: colazione, spuntino, pranzo, cena
    # Used for daily meal planning and analysis
    meal_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of meal (colazione, spuntino, pranzo, cena)"
    )

    # Ingredients (For Free Meals Only)
    # ---------------------------------
    # JSONB array of ingredients if this is a free meal (not from recipe)
    # NULL if meal was created from a recipe (use recipe.ingredients instead)
    # Format same as Recipe.ingredients
    ingredients = Column(
        JSONB,
        nullable=True,
        comment="Ingredients for free meals (NULL if from recipe)"
    )

    # Quantity Information
    # --------------------
    # Total quantity of food consumed in grams
    # For recipes: may differ from recipe total if partial portion consumed
    # For free meals: sum of all ingredient quantities
    quantity_grams = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total quantity consumed in grams"
    )

    # Nutritional Values (Consumed)
    # -----------------------------
    # These represent the actual nutrients consumed in this specific meal
    # They may differ from recipe totals if:
    # - User consumed a partial portion (e.g., half the recipe)
    # - User adjusted quantities
    # - Meal was a free meal with custom ingredients
    #
    # All values are for the total consumed amount, not per 100g

    # Total calories consumed in this meal
    calories = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total calories consumed"
    )

    # Total protein consumed in grams
    proteins_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total protein in grams"
    )

    # Total fat consumed in grams
    fats_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total fat in grams"
    )

    # Total carbohydrates consumed in grams
    carbs_g = Column(
        Numeric(10, 2),
        nullable=True,
        comment="Total carbohydrates in grams"
    )

    # Timing and Notes
    # ----------------
    # When the meal was actually consumed
    # Critical for:
    # - Daily/weekly summaries
    # - Meal timing analysis
    # - Correlation with health events
    # - Trend analysis
    consumed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="When the meal was consumed"
    )

    # Optional notes about the meal
    # Can include:
    # - How it tasted
    # - How user felt after eating
    # - Special circumstances
    # - Cooking modifications
    notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about the meal"
    )

    # Relationships
    # -------------
    # These will be uncommented when related models are available
    # user = relationship("User", back_populates="meals")
    # house = relationship("House", back_populates="meals")
    # recipe = relationship("Recipe", back_populates="meals")

    def __repr__(self):
        """String representation for debugging."""
        meal_source = f"recipe_id={self.recipe_id}" if self.recipe_id else "free meal"
        return f"<Meal(id={self.id}, user_id={self.user_id}, {meal_source}, consumed_at={self.consumed_at})>"

    @property
    def is_from_recipe(self) -> bool:
        """Check if meal was created from a recipe."""
        return self.recipe_id is not None

    @property
    def is_free_meal(self) -> bool:
        """Check if meal was entered manually (not from recipe)."""
        return self.recipe_id is None

    @property
    def macros_summary(self) -> dict:
        """Get macro summary as dictionary."""
        return {
            "calories": float(self.calories) if self.calories else 0,
            "proteins_g": float(self.proteins_g) if self.proteins_g else 0,
            "fats_g": float(self.fats_g) if self.fats_g else 0,
            "carbs_g": float(self.carbs_g) if self.carbs_g else 0,
        }


# Database Indexes
# ----------------
# Composite index for user's meals by date
# Most common query: "get all meals for user X in date range Y"
# Speeds up: SELECT * FROM meals WHERE user_id = ? AND consumed_at BETWEEN ? AND ?
Index(
    'idx_meals_user_date',
    Meal.user_id,
    Meal.consumed_at
)

# Composite index for house meals with date
# Used for house-wide nutritional summaries
# Speeds up: SELECT * FROM meals WHERE house_id = ? AND consumed_at BETWEEN ? AND ?
Index(
    'idx_meals_house_date',
    Meal.house_id,
    Meal.consumed_at
)

# Composite index for meal type analysis
# Speeds up: SELECT * FROM meals WHERE user_id = ? AND meal_type = ?
Index(
    'idx_meals_user_type',
    Meal.user_id,
    Meal.meal_type
)

# Index for recipe tracking (already created via index=True on recipe_id)
# Allows: SELECT * FROM meals WHERE recipe_id = ? (find all times recipe was consumed)
