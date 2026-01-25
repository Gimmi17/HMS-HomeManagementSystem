"""
Recipe Pydantic Schemas
Request and response models for Recipe API endpoints.

These schemas define the structure of data sent to and received from
the Recipes API. They provide validation, serialization, and documentation.
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class RecipeIngredient(BaseModel):
    """
    Single ingredient in a recipe.

    This schema defines the structure of each ingredient in the recipe's
    ingredients array. Ingredients can be:
    - Configured: linked to a food in the database (has food_id)
    - Unconfigured: free text ingredient (no food_id, needs_configuration=True)

    Attributes:
        food_id: UUID of the food item from foods table (optional for free text ingredients)
        food_name: Display name of the food
        quantity: Numeric quantity value (user input)
        unit: Unit of measurement (g, kg, ml, l, pezzi, cucchiaio, etc.)
        quantity_g: Quantity converted to grams (for nutrition calculation)
        needs_configuration: True if ingredient is not linked to a food in database

    Example (configured):
        {
            "food_id": "uuid-of-chicken",
            "food_name": "Pollo petto",
            "quantity": 200,
            "unit": "g",
            "quantity_g": 200.0,
            "needs_configuration": false
        }

    Example (unconfigured):
        {
            "food_name": "Spezie miste",
            "quantity": 1,
            "unit": "cucchiaino",
            "quantity_g": 5.0,
            "needs_configuration": true
        }
    """
    food_id: Optional[UUID] = Field(None, description="UUID of food from foods table (null for free text ingredients)")
    food_name: str = Field(..., min_length=1, max_length=255, description="Name of the food")
    quantity: float = Field(..., gt=0, description="Numeric quantity value")
    unit: str = Field(default="g", max_length=50, description="Unit of measurement (g, kg, ml, l, pezzi, etc.)")
    quantity_g: float = Field(..., gt=0, description="Quantity in grams (for nutrition calculation)")
    needs_configuration: bool = Field(default=False, description="True if ingredient needs to be linked to a food")

    model_config = ConfigDict(from_attributes=True)


class RecipeBase(BaseModel):
    """
    Base Recipe schema with common fields.
    Used as parent class for create/update schemas.
    """
    name: str = Field(..., min_length=1, max_length=255, description="Recipe name")
    description: Optional[str] = Field(None, description="Short recipe description")
    procedure: Optional[str] = Field(None, description="Step-by-step cooking instructions")
    preparation_time_min: Optional[int] = Field(None, ge=0, description="Preparation time in minutes")
    difficulty: Optional[str] = Field(None, description="Difficulty level (easy, medium, hard)")
    tags: List[str] = Field(default=[], description="Recipe tags for categorization")

    @field_validator('difficulty')
    @classmethod
    def validate_difficulty(cls, v: Optional[str]) -> Optional[str]:
        """Validate difficulty is one of the allowed values."""
        if v is not None:
            allowed = ['easy', 'medium', 'hard']
            if v.lower() not in allowed:
                raise ValueError(f"Difficulty must be one of: {', '.join(allowed)}")
            return v.lower()
        return v

    @field_validator('tags')
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """Ensure tags are lowercase and non-empty."""
        return [tag.lower().strip() for tag in v if tag.strip()]


class RecipeCreate(RecipeBase):
    """
    Schema for creating a new recipe.

    Used by: POST /api/v1/recipes

    Requires:
        - name: Recipe name
        - ingredients: At least one ingredient with valid food_id and quantity

    Optional:
        - description, procedure, preparation_time_min, difficulty, tags

    The house_id and created_by are extracted from the authenticated user,
    not from the request body.

    Example request:
        {
            "name": "Pasta al Pomodoro",
            "description": "Classic Italian pasta",
            "procedure": "1. Boil water\\n2. Cook pasta\\n3. Add sauce",
            "ingredients": [
                {
                    "food_id": "uuid-of-pasta",
                    "food_name": "Pasta",
                    "quantity_g": 100.0
                },
                {
                    "food_id": "uuid-of-tomato",
                    "food_name": "Pomodori",
                    "quantity_g": 200.0
                }
            ],
            "preparation_time_min": 20,
            "difficulty": "easy",
            "tags": ["veloce", "vegetariano"]
        }
    """
    ingredients: List[RecipeIngredient] = Field(
        ...,
        min_length=1,
        description="List of ingredients (at least 1 required)"
    )

    @field_validator('ingredients')
    @classmethod
    def validate_ingredients(cls, v: List[RecipeIngredient]) -> List[RecipeIngredient]:
        """Ensure at least one ingredient is provided."""
        if not v:
            raise ValueError("Recipe must have at least one ingredient")
        return v


class RecipeUpdate(RecipeBase):
    """
    Schema for updating an existing recipe.

    Used by: PUT /api/v1/recipes/{id}

    All fields are optional - only provided fields will be updated.
    Nutritional values are automatically recalculated if ingredients change.

    Example request (partial update):
        {
            "name": "Pasta al Pomodoro e Basilico",
            "tags": ["veloce", "vegetariano", "estivo"]
        }
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Recipe name")
    ingredients: Optional[List[RecipeIngredient]] = Field(None, min_length=1, description="Updated ingredients")

    @field_validator('ingredients')
    @classmethod
    def validate_ingredients(cls, v: Optional[List[RecipeIngredient]]) -> Optional[List[RecipeIngredient]]:
        """Ensure at least one ingredient if updating ingredients."""
        if v is not None and len(v) == 0:
            raise ValueError("Recipe must have at least one ingredient")
        return v


class RecipeNutrition(BaseModel):
    """
    Nutritional summary for a recipe.

    This schema contains the calculated nutritional totals for the entire recipe.
    These values are computed server-side from the ingredients.

    All values represent totals for the complete recipe, not per serving or per 100g.
    """
    total_calories: Optional[float] = Field(None, description="Total calories for entire recipe")
    total_proteins_g: Optional[float] = Field(None, description="Total protein in grams")
    total_fats_g: Optional[float] = Field(None, description="Total fat in grams")
    total_carbs_g: Optional[float] = Field(None, description="Total carbohydrates in grams")

    model_config = ConfigDict(from_attributes=True)


class RecipeIngredientWithNutrition(RecipeIngredient):
    """
    Recipe ingredient with nutritional information included.

    Extends RecipeIngredient to include the calculated nutrients for
    this specific quantity of the ingredient.

    Used in detailed recipe responses to show per-ingredient nutrition.
    Note: Unconfigured ingredients (needs_configuration=True) will have null nutrition values.

    Example (configured):
        {
            "food_id": "uuid",
            "food_name": "Pollo petto",
            "quantity": 200,
            "unit": "g",
            "quantity_g": 200.0,
            "needs_configuration": false,
            "calories": 220.0,
            "proteins_g": 46.0,
            "fats_g": 2.4,
            "carbs_g": 0.0
        }

    Example (unconfigured):
        {
            "food_name": "Spezie miste",
            "quantity": 1,
            "unit": "cucchiaino",
            "quantity_g": 5.0,
            "needs_configuration": true,
            "calories": null,
            "proteins_g": null,
            "fats_g": null,
            "carbs_g": null
        }
    """
    calories: Optional[float] = Field(None, description="Calories for this ingredient quantity (null if unconfigured)")
    proteins_g: Optional[float] = Field(None, description="Protein for this ingredient quantity (null if unconfigured)")
    fats_g: Optional[float] = Field(None, description="Fat for this ingredient quantity (null if unconfigured)")
    carbs_g: Optional[float] = Field(None, description="Carbs for this ingredient quantity (null if unconfigured)")


class RecipeResponse(RecipeBase, RecipeNutrition):
    """
    Complete Recipe response schema.

    Returned by:
        - GET /api/v1/recipes/{id} - Get single recipe details
        - POST /api/v1/recipes - Create recipe
        - PUT /api/v1/recipes/{id} - Update recipe

    Includes all recipe information:
        - Basic info (name, description, procedure, etc.)
        - Ingredients list
        - Nutritional totals
        - Metadata (id, timestamps, ownership)
    """
    id: UUID = Field(..., description="Unique recipe identifier")
    house_id: UUID = Field(..., description="House this recipe belongs to")
    created_by: Optional[UUID] = Field(None, description="User who created this recipe")
    ingredients: List[RecipeIngredient] = Field(..., description="Recipe ingredients")
    created_at: datetime = Field(..., description="When recipe was created")
    updated_at: datetime = Field(..., description="When recipe was last updated")

    model_config = ConfigDict(from_attributes=True)


class RecipeDetailResponse(RecipeResponse):
    """
    Detailed Recipe response with per-ingredient nutrition.

    Returned by:
        - GET /api/v1/recipes/{id} - Get single recipe with full details

    Same as RecipeResponse but ingredients include their individual
    nutritional values calculated for the specified quantities.

    This allows the frontend to show:
        - Total recipe nutrition
        - Per-ingredient nutrition breakdown
        - Nutrition analysis and comparisons
    """
    ingredients: List[RecipeIngredientWithNutrition] = Field(
        ...,
        description="Recipe ingredients with individual nutrition"
    )


class RecipeListItem(BaseModel):
    """
    Simplified Recipe schema for list/search results.

    Returned by:
        - GET /api/v1/recipes - List recipes

    Contains only essential fields for recipe browsing:
        - Basic info (id, name, description)
        - Summary stats (ingredient count, prep time, difficulty)
        - Nutritional totals
        - Tags for filtering

    This reduces response size for list views where full details aren't needed.
    """
    id: UUID = Field(..., description="Unique recipe identifier")
    name: str = Field(..., description="Recipe name")
    description: Optional[str] = Field(None, description="Short description")
    ingredient_count: int = Field(..., description="Number of ingredients")
    preparation_time_min: Optional[int] = Field(None, description="Preparation time in minutes")
    difficulty: Optional[str] = Field(None, description="Difficulty level")
    tags: List[str] = Field(default=[], description="Recipe tags")
    total_calories: Optional[float] = Field(None, description="Total calories")
    total_proteins_g: Optional[float] = Field(None, description="Total protein in grams")
    total_fats_g: Optional[float] = Field(None, description="Total fat in grams")
    total_carbs_g: Optional[float] = Field(None, description="Total carbs in grams")
    created_at: datetime = Field(..., description="When recipe was created")

    model_config = ConfigDict(from_attributes=True)


class RecipeListResponse(BaseModel):
    """
    Paginated list of recipes response.

    Returned by:
        - GET /api/v1/recipes - List/search recipes with pagination

    Provides metadata about the result set for frontend pagination.
    """
    recipes: List[RecipeListItem] = Field(..., description="List of recipes")
    total: int = Field(..., description="Total number of recipes matching query")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(0, description="Number of results skipped")

    model_config = ConfigDict(from_attributes=True)


# Example Usage:
# --------------
# POST /api/v1/recipes
# Request Body (RecipeCreate):
# {
#   "name": "Chicken Pasta",
#   "description": "Creamy chicken pasta",
#   "procedure": "1. Cook pasta\n2. Cook chicken\n3. Mix with cream",
#   "ingredients": [
#     {"food_id": "uuid-pasta", "food_name": "Pasta", "quantity_g": 100},
#     {"food_id": "uuid-chicken", "food_name": "Pollo", "quantity_g": 150}
#   ],
#   "preparation_time_min": 25,
#   "difficulty": "medium",
#   "tags": ["comfort", "proteico"]
# }
#
# Response (RecipeResponse):
# {
#   "id": "uuid",
#   "house_id": "uuid",
#   "created_by": "uuid",
#   "name": "Chicken Pasta",
#   "description": "Creamy chicken pasta",
#   "procedure": "1. Cook pasta\n2. Cook chicken\n3. Mix with cream",
#   "ingredients": [
#     {"food_id": "uuid-pasta", "food_name": "Pasta", "quantity_g": 100},
#     {"food_id": "uuid-chicken", "food_name": "Pollo", "quantity_g": 150}
#   ],
#   "preparation_time_min": 25,
#   "difficulty": "medium",
#   "tags": ["comfort", "proteico"],
#   "total_calories": 520.5,
#   "total_proteins_g": 42.3,
#   "total_fats_g": 8.7,
#   "total_carbs_g": 75.2,
#   "created_at": "2026-01-15T10:30:00Z",
#   "updated_at": "2026-01-15T10:30:00Z"
# }
