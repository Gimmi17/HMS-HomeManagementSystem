"""
Meal Pydantic Schemas
Request and response models for Meal API endpoints.

These schemas define the structure of data sent to and received from
the Meals API. They provide validation, serialization, and documentation.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.schemas.recipe import RecipeIngredient


class MealBase(BaseModel):
    """
    Base Meal schema with common fields.
    Used as parent class for create/update schemas.
    """
    meal_type: str = Field(..., description="Type of meal (colazione, spuntino, pranzo, cena)")
    consumed_at: datetime = Field(..., description="When the meal was consumed")
    notes: Optional[str] = Field(None, description="Optional notes about the meal")

    @field_validator('meal_type')
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        """Validate meal_type is one of the allowed values."""
        allowed = ['colazione', 'spuntino', 'pranzo', 'cena']
        v_lower = v.lower()
        if v_lower not in allowed:
            raise ValueError(f"Meal type must be one of: {', '.join(allowed)}")
        return v_lower


class MealCreate(MealBase):
    """
    Schema for creating a new meal record.

    Used by: POST /api/v1/meals

    There are two modes for creating a meal:

    Mode 1 - From Recipe:
        - Provide recipe_id
        - Optionally provide quantity_grams to adjust portion size
        - Nutrients are calculated from recipe (or adjusted by portion)
        - ingredients field should be omitted or null

    Mode 2 - Free Meal (manual ingredients):
        - Provide ingredients list
        - recipe_id should be omitted or null
        - Nutrients are calculated from ingredients
        - Optionally provide quantity_grams as sum of ingredient quantities

    The user_id and house_id are extracted from the authenticated user.

    Example (from recipe):
        {
            "recipe_id": "uuid-of-recipe",
            "meal_type": "pranzo",
            "quantity_grams": 300.0,
            "consumed_at": "2026-01-15T13:30:00Z",
            "notes": "Very tasty!"
        }

    Example (free meal):
        {
            "meal_type": "cena",
            "ingredients": [
                {"food_id": "uuid", "food_name": "Pollo", "quantity_g": 150},
                {"food_id": "uuid", "food_name": "Riso", "quantity_g": 80}
            ],
            "consumed_at": "2026-01-15T20:00:00Z"
        }
    """
    recipe_id: Optional[UUID] = Field(None, description="Recipe ID if meal from recipe")
    ingredients: Optional[List[RecipeIngredient]] = Field(
        None,
        description="Ingredients if free meal (NULL if from recipe)"
    )
    quantity_grams: Optional[float] = Field(None, gt=0, description="Total quantity consumed in grams")

    @field_validator('ingredients')
    @classmethod
    def validate_ingredients_or_recipe(cls, v: Optional[List[RecipeIngredient]], info) -> Optional[List[RecipeIngredient]]:
        """
        Validate that either recipe_id or ingredients is provided, but not both.
        """
        # Note: In Pydantic v2, we can access other fields via info.data
        recipe_id = info.data.get('recipe_id')

        # Must have either recipe_id OR ingredients, not both, not neither
        has_recipe = recipe_id is not None
        has_ingredients = v is not None and len(v) > 0

        if has_recipe and has_ingredients:
            raise ValueError("Cannot provide both recipe_id and ingredients. Use recipe_id for recipe-based meals, or ingredients for free meals.")

        if not has_recipe and not has_ingredients:
            raise ValueError("Must provide either recipe_id (for recipe meal) or ingredients (for free meal)")

        # If ingredients provided, ensure at least one
        if has_ingredients and len(v) == 0:
            raise ValueError("Free meal must have at least one ingredient")

        return v


class MealUpdate(BaseModel):
    """
    Schema for updating an existing meal record.

    Used by: PUT /api/v1/meals/{id}

    All fields are optional - only provided fields will be updated.
    Note: Changing ingredients or recipe_id will recalculate nutritional values.

    Example (update notes and time):
        {
            "consumed_at": "2026-01-15T13:45:00Z",
            "notes": "Added extra cheese - was delicious!"
        }
    """
    meal_type: Optional[str] = Field(None, description="Type of meal")
    consumed_at: Optional[datetime] = Field(None, description="When consumed")
    notes: Optional[str] = Field(None, description="Notes")
    quantity_grams: Optional[float] = Field(None, gt=0, description="Quantity in grams")

    @field_validator('meal_type')
    @classmethod
    def validate_meal_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate meal_type if provided."""
        if v is not None:
            allowed = ['colazione', 'spuntino', 'pranzo', 'cena']
            v_lower = v.lower()
            if v_lower not in allowed:
                raise ValueError(f"Meal type must be one of: {', '.join(allowed)}")
            return v_lower
        return v


class MealNutrition(BaseModel):
    """
    Nutritional information for a consumed meal.

    All values represent the actual nutrients consumed in this specific meal instance.
    These are calculated from either:
        - Recipe nutrients (if from recipe)
        - Ingredient nutrients (if free meal)

    Values may be adjusted based on portion size (quantity_grams).
    """
    calories: Optional[float] = Field(None, description="Total calories consumed")
    proteins_g: Optional[float] = Field(None, description="Total protein in grams")
    fats_g: Optional[float] = Field(None, description="Total fat in grams")
    carbs_g: Optional[float] = Field(None, description="Total carbohydrates in grams")

    model_config = ConfigDict(from_attributes=True)


class MealResponse(MealBase, MealNutrition):
    """
    Complete Meal response schema.

    Returned by:
        - GET /api/v1/meals/{id} - Get single meal details
        - POST /api/v1/meals - Create meal
        - PUT /api/v1/meals/{id} - Update meal

    Includes all meal information:
        - Basic info (meal_type, consumed_at, notes)
        - Nutritional values
        - Reference to recipe (if from recipe)
        - Ingredients (if free meal)
        - Metadata (id, timestamps, user)
    """
    id: UUID = Field(..., description="Unique meal identifier")
    user_id: UUID = Field(..., description="User who consumed this meal")
    house_id: UUID = Field(..., description="House the user belongs to")
    recipe_id: Optional[UUID] = Field(None, description="Recipe ID if meal from recipe")
    ingredients: Optional[List[RecipeIngredient]] = Field(None, description="Ingredients if free meal")
    quantity_grams: Optional[float] = Field(None, description="Quantity consumed in grams")
    created_at: datetime = Field(..., description="When meal record was created")
    updated_at: datetime = Field(..., description="When meal was last updated")

    model_config = ConfigDict(from_attributes=True)


class MealDetailResponse(MealResponse):
    """
    Detailed Meal response with recipe information included.

    Returned by:
        - GET /api/v1/meals/{id} - Get single meal with full details

    Same as MealResponse but includes the full recipe object if meal
    was created from a recipe. This allows showing recipe details
    without an additional API call.
    """
    recipe_name: Optional[str] = Field(None, description="Name of recipe if from recipe")
    recipe_description: Optional[str] = Field(None, description="Recipe description if from recipe")


class MealListItem(BaseModel):
    """
    Simplified Meal schema for list/search results.

    Returned by:
        - GET /api/v1/meals - List meals

    Contains only essential fields for meal browsing:
        - Basic info (id, meal_type, consumed_at)
        - Nutritional summary
        - Reference to recipe name if applicable
        - Notes preview

    This reduces response size for list views.
    """
    id: UUID = Field(..., description="Unique meal identifier")
    user_id: UUID = Field(..., description="User who consumed this meal")
    meal_type: str = Field(..., description="Type of meal")
    consumed_at: datetime = Field(..., description="When consumed")
    recipe_id: Optional[UUID] = Field(None, description="Recipe ID if from recipe")
    recipe_name: Optional[str] = Field(None, description="Recipe name if from recipe")
    calories: Optional[float] = Field(None, description="Total calories")
    proteins_g: Optional[float] = Field(None, description="Total protein")
    fats_g: Optional[float] = Field(None, description="Total fat")
    carbs_g: Optional[float] = Field(None, description="Total carbs")
    notes: Optional[str] = Field(None, description="Notes")
    created_at: datetime = Field(..., description="When created")

    model_config = ConfigDict(from_attributes=True)


class MealListResponse(BaseModel):
    """
    Paginated list of meals response.

    Returned by:
        - GET /api/v1/meals - List/search meals with pagination

    Provides metadata about the result set for frontend pagination.
    """
    meals: List[MealListItem] = Field(..., description="List of meals")
    total: int = Field(..., description="Total number of meals matching query")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(0, description="Number of results skipped")

    model_config = ConfigDict(from_attributes=True)


class MealNutritionSummary(BaseModel):
    """
    Nutritional summary for a period (day, week, month).

    Returned by:
        - GET /api/v1/meals/summary - Get nutritional summary for period

    Provides aggregated nutrition data:
        - Total calories consumed
        - Total macros consumed
        - Average per day
        - Meal count
    """
    period_start: datetime = Field(..., description="Start of period")
    period_end: datetime = Field(..., description="End of period")
    total_meals: int = Field(..., description="Number of meals in period")
    total_calories: float = Field(..., description="Total calories consumed")
    total_proteins_g: float = Field(..., description="Total protein consumed")
    total_fats_g: float = Field(..., description="Total fat consumed")
    total_carbs_g: float = Field(..., description="Total carbs consumed")
    avg_calories_per_day: float = Field(..., description="Average calories per day")
    avg_proteins_per_day: float = Field(..., description="Average protein per day")
    avg_fats_per_day: float = Field(..., description="Average fat per day")
    avg_carbs_per_day: float = Field(..., description="Average carbs per day")
    by_meal_type: dict = Field(..., description="Breakdown by meal type")

    model_config = ConfigDict(from_attributes=True)


# Example Usage:
# --------------
# POST /api/v1/meals (from recipe)
# Request Body (MealCreate):
# {
#   "recipe_id": "uuid-of-recipe",
#   "meal_type": "pranzo",
#   "quantity_grams": 350.0,
#   "consumed_at": "2026-01-15T13:30:00Z",
#   "notes": "Delicious!"
# }
#
# Response (MealResponse):
# {
#   "id": "uuid",
#   "user_id": "uuid",
#   "house_id": "uuid",
#   "recipe_id": "uuid-of-recipe",
#   "meal_type": "pranzo",
#   "ingredients": null,
#   "quantity_grams": 350.0,
#   "calories": 450.5,
#   "proteins_g": 35.2,
#   "fats_g": 12.3,
#   "carbs_g": 55.8,
#   "consumed_at": "2026-01-15T13:30:00Z",
#   "notes": "Delicious!",
#   "created_at": "2026-01-15T13:35:00Z",
#   "updated_at": "2026-01-15T13:35:00Z"
# }
#
# POST /api/v1/meals (free meal)
# Request Body (MealCreate):
# {
#   "meal_type": "cena",
#   "ingredients": [
#     {"food_id": "uuid", "food_name": "Pollo", "quantity_g": 150},
#     {"food_id": "uuid", "food_name": "Riso", "quantity_g": 80}
#   ],
#   "consumed_at": "2026-01-15T20:00:00Z"
# }
#
# Response (MealResponse):
# {
#   "id": "uuid",
#   "user_id": "uuid",
#   "house_id": "uuid",
#   "recipe_id": null,
#   "meal_type": "cena",
#   "ingredients": [
#     {"food_id": "uuid", "food_name": "Pollo", "quantity_g": 150},
#     {"food_id": "uuid", "food_name": "Riso", "quantity_g": 80}
#   ],
#   "quantity_grams": 230.0,
#   "calories": 420.0,
#   "proteins_g": 38.5,
#   "fats_g": 6.2,
#   "carbs_g": 58.3,
#   "consumed_at": "2026-01-15T20:00:00Z",
#   "notes": null,
#   "created_at": "2026-01-15T20:05:00Z",
#   "updated_at": "2026-01-15T20:05:00Z"
# }
