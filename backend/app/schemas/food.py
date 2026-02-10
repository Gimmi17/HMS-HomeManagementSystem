"""
Food Pydantic Schemas
Request and response models for Food API endpoints.

These schemas define the structure of data sent to and received from
the Foods API. They provide validation, serialization, and documentation.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class FoodBase(BaseModel):
    """
    Base Food schema with common fields.
    Used as parent class for other Food schemas.
    """
    name: str = Field(..., max_length=255, description="Food name (e.g., 'Pollo', 'Pasta')")
    category: Optional[str] = Field(None, max_length=100, description="Food category (e.g., 'Carne', 'Verdura')")


class FoodNutrients(BaseModel):
    """
    Nutritional information schema.
    All values are per 100g of food.

    This schema is used both for detailed food responses and for
    embedding nutritional info in other responses (e.g., recipe ingredients).
    """
    # Macronutrients
    proteins_g: Optional[float] = Field(None, ge=0, description="Protein in grams per 100g")
    fats_g: Optional[float] = Field(None, ge=0, description="Fat in grams per 100g")
    carbs_g: Optional[float] = Field(None, ge=0, description="Carbohydrates in grams per 100g")
    fibers_g: Optional[float] = Field(None, ge=0, description="Fiber in grams per 100g")

    # Essential fatty acids
    omega3_ala_g: Optional[float] = Field(None, ge=0, description="Omega-3 (ALA) in grams per 100g")
    omega6_g: Optional[float] = Field(None, ge=0, description="Omega-6 in grams per 100g")

    # Minerals (stored in grams)
    calcium_g: Optional[float] = Field(None, ge=0, description="Calcium in grams per 100g")
    iron_g: Optional[float] = Field(None, ge=0, description="Iron in grams per 100g")
    magnesium_g: Optional[float] = Field(None, ge=0, description="Magnesium in grams per 100g")
    potassium_g: Optional[float] = Field(None, ge=0, description="Potassium in grams per 100g")
    zinc_g: Optional[float] = Field(None, ge=0, description="Zinc in grams per 100g")

    # Vitamins (stored in grams)
    vitamin_a_g: Optional[float] = Field(None, ge=0, description="Vitamin A in grams per 100g")
    vitamin_c_g: Optional[float] = Field(None, ge=0, description="Vitamin C in grams per 100g")
    vitamin_d_g: Optional[float] = Field(None, ge=0, description="Vitamin D in grams per 100g")
    vitamin_e_g: Optional[float] = Field(None, ge=0, description="Vitamin E in grams per 100g")
    vitamin_k_g: Optional[float] = Field(None, ge=0, description="Vitamin K in grams per 100g")
    vitamin_b6_g: Optional[float] = Field(None, ge=0, description="Vitamin B6 in grams per 100g")
    folate_b9_g: Optional[float] = Field(None, ge=0, description="Folate (B9) in grams per 100g")
    vitamin_b12_g: Optional[float] = Field(None, ge=0, description="Vitamin B12 in grams per 100g")


class FoodCreate(FoodBase, FoodNutrients):
    """
    Schema for creating a new food.
    """
    pass


class FoodUpdate(BaseModel):
    """
    Schema for updating a food.
    All fields are optional.
    """
    name: Optional[str] = Field(None, max_length=255, description="Food name")
    category: Optional[str] = Field(None, max_length=100, description="Food category")

    # Macronutrients
    proteins_g: Optional[float] = Field(None, ge=0, description="Protein in grams per 100g")
    fats_g: Optional[float] = Field(None, ge=0, description="Fat in grams per 100g")
    carbs_g: Optional[float] = Field(None, ge=0, description="Carbohydrates in grams per 100g")
    fibers_g: Optional[float] = Field(None, ge=0, description="Fiber in grams per 100g")

    # Essential fatty acids
    omega3_ala_g: Optional[float] = Field(None, ge=0)
    omega6_g: Optional[float] = Field(None, ge=0)

    # Minerals
    calcium_g: Optional[float] = Field(None, ge=0)
    iron_g: Optional[float] = Field(None, ge=0)
    magnesium_g: Optional[float] = Field(None, ge=0)
    potassium_g: Optional[float] = Field(None, ge=0)
    zinc_g: Optional[float] = Field(None, ge=0)

    # Vitamins
    vitamin_a_g: Optional[float] = Field(None, ge=0)
    vitamin_c_g: Optional[float] = Field(None, ge=0)
    vitamin_d_g: Optional[float] = Field(None, ge=0)
    vitamin_e_g: Optional[float] = Field(None, ge=0)
    vitamin_k_g: Optional[float] = Field(None, ge=0)
    vitamin_b6_g: Optional[float] = Field(None, ge=0)
    folate_b9_g: Optional[float] = Field(None, ge=0)
    vitamin_b12_g: Optional[float] = Field(None, ge=0)


class FoodResponse(FoodBase, FoodNutrients):
    """
    Complete Food response schema.

    Returned by:
        - GET /api/v1/foods/{id} - Get single food details
        - GET /api/v1/foods (in list) - Search foods

    Includes all food information: basic info + full nutritional data.
    """
    id: UUID = Field(..., description="Unique food identifier")
    house_id: Optional[UUID] = Field(None, description="House this food belongs to (null = global template)")
    created_at: datetime = Field(..., description="When food was added to database")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


class FoodSearchResult(FoodBase):
    """
    Simplified Food schema for search results.

    Returned by:
        - GET /api/v1/foods?search=xxx - Autocomplete search

    Contains only essential fields for autocomplete/search:
        - id, name, category
        - Primary macros (proteins, fats, carbs)

    This reduces response size for autocomplete queries where full
    nutritional details are not needed.
    """
    id: UUID = Field(..., description="Unique food identifier")

    # Include only primary macros for search results
    proteins_g: Optional[float] = Field(None, ge=0, description="Protein in grams per 100g")
    fats_g: Optional[float] = Field(None, ge=0, description="Fat in grams per 100g")
    carbs_g: Optional[float] = Field(None, ge=0, description="Carbohydrates in grams per 100g")
    fibers_g: Optional[float] = Field(None, ge=0, description="Fiber in grams per 100g")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


class FoodListResponse(BaseModel):
    """
    Paginated list of foods response.

    Returned by:
        - GET /api/v1/foods - List/search foods with pagination

    Provides metadata about the result set for frontend pagination.
    """
    foods: list[FoodSearchResult] = Field(..., description="List of foods matching query")
    total: int = Field(..., description="Total number of foods matching query")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(0, description="Number of results skipped")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


class CategoryResponse(BaseModel):
    """
    Food categories response.

    Returned by:
        - GET /api/v1/foods/categories - Get list of all unique categories

    Used to populate category filter dropdown in frontend.
    """
    categories: list[str] = Field(..., description="List of unique food categories")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


# Example Usage:
# --------------
# GET /api/v1/foods?search=pollo&category=Carne&limit=10
# Response:
# {
#   "foods": [
#     {
#       "id": "uuid",
#       "name": "Pollo petto",
#       "category": "Carne",
#       "proteins_g": 23.0,
#       "fats_g": 1.2,
#       "carbs_g": 0.0,
#       "fibers_g": 0.0
#     }
#   ],
#   "total": 1,
#   "limit": 10,
#   "offset": 0
# }
