"""
Foods API Endpoints
Provides access to the food nutritional database.

Endpoints:
    - GET /foods - Search and list foods with filters
    - GET /foods/{id} - Get single food details
    - GET /foods/categories - Get list of all categories

These endpoints are READ-ONLY. Foods are imported from CSV during seeding
and cannot be created/modified/deleted via API.
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.session import get_db
from app.models.food import Food
from app.schemas.food import (
    FoodResponse,
    FoodSearchResult,
    FoodListResponse,
    CategoryResponse
)

# Create router for foods endpoints
# Prefix: /api/v1/foods
# Tags: ["foods"] for OpenAPI docs grouping
router = APIRouter(prefix="/foods", tags=["foods"])


@router.get("", response_model=FoodListResponse)
def search_foods(
    search: Optional[str] = Query(
        None,
        description="Search term for food name (case-insensitive, partial match)"
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by food category (e.g., 'Carne', 'Verdura')"
    ),
    limit: int = Query(
        50,
        ge=1,
        le=200,
        description="Maximum number of results to return (1-200)"
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Number of results to skip (for pagination)"
    ),
    db: Session = Depends(get_db)
):
    """
    Search and list foods with optional filters.

    This endpoint supports:
    - Free-text search on food name (case-insensitive, partial match)
    - Category filtering
    - Pagination via limit/offset

    Use Cases:
        - Autocomplete ingredient search in recipe forms
        - Browse foods by category
        - Find nutritional info for specific foods

    Query Parameters:
        - search: Text to search in food names (e.g., "pollo", "mele")
        - category: Filter by category (e.g., "Carne", "Frutta", "Verdura")
        - limit: Number of results per page (default 50, max 200)
        - offset: Skip first N results (for pagination)

    Returns:
        FoodListResponse with:
            - foods: List of matching foods (simplified schema)
            - total: Total number of matching foods
            - limit: Applied limit
            - offset: Applied offset

    Examples:
        GET /api/v1/foods?search=pollo
        → Returns all foods with "pollo" in name

        GET /api/v1/foods?category=Verdura&limit=20
        → Returns first 20 vegetables

        GET /api/v1/foods?search=mele&category=Frutta
        → Returns fruits with "mele" in name
    """
    # Build base query
    query = db.query(Food)

    # Apply search filter (case-insensitive ILIKE)
    if search:
        # ILIKE is PostgreSQL case-insensitive LIKE
        # %search% matches anywhere in the string
        search_pattern = f"%{search}%"
        query = query.filter(Food.name.ilike(search_pattern))

    # Apply category filter (exact match, case-sensitive)
    if category:
        query = query.filter(Food.category == category)

    # Get total count before pagination
    total = query.count()

    # Apply ordering (alphabetical by name) and pagination
    foods = query.order_by(Food.name).limit(limit).offset(offset).all()

    # Return response with pagination metadata
    return FoodListResponse(
        foods=foods,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/categories", response_model=CategoryResponse)
def get_categories(db: Session = Depends(get_db)):
    """
    Get list of all unique food categories.

    Returns all distinct category values from the foods table.
    Used to populate category filter dropdown in frontend.

    Returns:
        CategoryResponse with list of unique categories

    Example Response:
        {
            "categories": [
                "Carne",
                "Cereali",
                "Frutta",
                "Latticini",
                "Legumi",
                "Pesce",
                "Verdura"
            ]
        }

    Note:
        Categories are sorted alphabetically.
        Null categories are excluded from results.
    """
    # Query distinct category values, excluding nulls
    # Use SQLAlchemy func.distinct() for database-level distinct
    categories = (
        db.query(Food.category)
        .filter(Food.category.isnot(None))  # Exclude null categories
        .distinct()
        .order_by(Food.category)  # Sort alphabetically
        .all()
    )

    # Extract category strings from query result tuples
    category_list = [cat[0] for cat in categories]

    return CategoryResponse(categories=category_list)


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(
    food_id: UUID,
    db: Session = Depends(get_db)
):
    """
    Get detailed information for a single food.

    Returns complete nutritional information including:
    - Basic info (name, category)
    - Macronutrients (proteins, fats, carbs, fibers)
    - Essential fatty acids (omega-3, omega-6)
    - Minerals (calcium, iron, magnesium, potassium, zinc)
    - Vitamins (A, C, D, E, K, B6, B9, B12)

    Path Parameters:
        food_id: UUID of the food to retrieve

    Returns:
        FoodResponse with complete nutritional data

    Raises:
        404: Food not found

    Example:
        GET /api/v1/foods/123e4567-e89b-12d3-a456-426614174000
        → Returns complete nutritional profile for that food

    Use Cases:
        - Display full nutritional info in food detail page
        - Calculate nutrients when adding ingredients to recipes
        - Show micronutrient breakdown for health-conscious users
    """
    # Query food by ID
    food = db.query(Food).filter(Food.id == food_id).first()

    # Return 404 if not found
    if not food:
        raise HTTPException(
            status_code=404,
            detail=f"Food with id {food_id} not found"
        )

    return food


# Additional utility endpoint (optional, can be added later):
# @router.get("/autocomplete", response_model=list[FoodSearchResult])
# def autocomplete_foods(
#     q: str = Query(..., min_length=2, description="Search query (min 2 chars)"),
#     limit: int = Query(10, ge=1, le=50),
#     db: Session = Depends(get_db)
# ):
#     """
#     Fast autocomplete endpoint optimized for typeahead search.
#
#     Differences from /foods:
#         - Requires minimum 2 characters
#         - Limited to 10 results by default
#         - Optimized for speed
#         - Returns minimal fields
#
#     Used in frontend autocomplete components with debouncing.
#     """
#     search_pattern = f"%{q}%"
#     foods = (
#         db.query(Food)
#         .filter(Food.name.ilike(search_pattern))
#         .order_by(Food.name)
#         .limit(limit)
#         .all()
#     )
#     return foods


# Security Notes:
# ---------------
# This endpoint is READ-ONLY (no authentication required in MVP).
# In production, you might want to:
#   1. Add authentication to track API usage
#   2. Add rate limiting to prevent abuse
#   3. Add caching (Redis) for frequently searched foods
#   4. Add full-text search (PostgreSQL tsvector) for better search performance
#
# Example with auth (for future):
# @router.get("", response_model=FoodListResponse)
# def search_foods(
#     ...,
#     current_user: User = Depends(get_current_user)  # Require auth
# ):
#     ...
