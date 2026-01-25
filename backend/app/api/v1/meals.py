"""
Meals API Endpoints
Provides CRUD operations for meal tracking.

Endpoints:
    - POST /meals - Create new meal (from recipe or free ingredients)
    - GET /meals - List meals with filters
    - GET /meals/{id} - Get single meal details
    - DELETE /meals/{id} - Delete meal

All endpoints require authentication.
Meals belong to a user and house for multi-tenant tracking.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.schemas.meal import (
    MealCreate,
    MealUpdate,
    MealResponse,
    MealDetailResponse,
    MealListItem,
    MealListResponse
)
from app.services.meal_service import (
    create_meal,
    get_meals,
    get_meal_by_id,
    update_meal,
    delete_meal,
    get_daily_nutrition_summary,
    get_period_nutrition_summary
)

# Create router for meals endpoints
# Prefix will be added in main router: /api/v1/meals
router = APIRouter(prefix="/meals", tags=["Meals"])


@router.post("", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
def create_new_meal(
    meal_data: MealCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new meal record.

    Two modes for creating meals:

    Mode 1 - From Recipe:
        Provide recipe_id to create meal from existing recipe.
        Nutritional values are inherited from recipe.

    Mode 2 - Free Meal:
        Provide ingredients list to create meal without recipe.
        Nutritional values are calculated from ingredients.

    Request Body:
        MealCreate schema with:
            - meal_type: Type of meal (colazione, spuntino, pranzo, cena)
            - consumed_at: When meal was consumed
            - recipe_id: Recipe ID (if from recipe) OR
            - ingredients: List of ingredients (if free meal)
            - quantity_grams: Optional total quantity
            - notes: Optional notes

    Authentication:
        Requires valid JWT token in Authorization header.

    Returns:
        MealResponse with created meal including calculated nutrition.

    Errors:
        400 Bad Request: Invalid data (missing recipe/ingredients, invalid ingredients)
        401 Unauthorized: Missing or invalid authentication
        404 Not Found: Recipe not found (if recipe_id provided)
        500 Internal Server Error: Database or calculation error

    Example Request (from recipe):
        POST /api/v1/meals
        {
            "recipe_id": "uuid-of-recipe",
            "meal_type": "pranzo",
            "consumed_at": "2026-01-15T13:30:00Z",
            "notes": "Delicious!"
        }

    Example Request (free meal):
        POST /api/v1/meals
        {
            "meal_type": "cena",
            "ingredients": [
                {"food_id": "uuid", "food_name": "Pollo", "quantity_g": 150},
                {"food_id": "uuid", "food_name": "Riso", "quantity_g": 80}
            ],
            "consumed_at": "2026-01-15T20:00:00Z"
        }
    """
    # Placeholder until auth is fully implemented
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Meal creation requires user_id and house_id from authenticated user. Complete auth implementation first."
    )

    # Future implementation when auth is ready:
    # try:
    #     meal = create_meal(
    #         db=db,
    #         user_id=current_user.id,
    #         house_id=current_user.house_id,  # Get from user's houses
    #         meal_data=meal_data
    #     )
    #     return meal
    # except ValueError as e:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    # except Exception as e:
    #     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("", response_model=MealListResponse)
def list_meals(
    house_id: UUID = Query(..., description="House ID to filter meals"),
    user_id: Optional[UUID] = Query(None, description="Filter by user ID"),
    meal_type: Optional[str] = Query(None, description="Filter by meal type"),
    recipe_id: Optional[UUID] = Query(None, description="Filter by recipe ID"),
    from_date: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    to_date: Optional[datetime] = Query(None, description="End date (ISO format)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results (1-200)"),
    offset: int = Query(0, ge=0, description="Results to skip (pagination)"),
    db: Session = Depends(get_db)
):
    """
    List meals with optional filters.

    Query Parameters:
        - house_id: House ID (required) - only meals from this house
        - user_id: Filter by specific user (optional)
        - meal_type: Filter by meal type (colazione, spuntino, pranzo, cena)
        - recipe_id: Filter by recipe (show all times a recipe was consumed)
        - from_date: Start of date range (ISO format: 2026-01-15T00:00:00Z)
        - to_date: End of date range
        - limit: Number of results per page (default 50, max 200)
        - offset: Skip first N results (for pagination)

    Returns:
        MealListResponse with:
            - meals: List of meals (simplified schema)
            - total: Total number of matching meals
            - limit: Applied limit
            - offset: Applied offset

    Note:
        Results are ordered by consumed_at descending (most recent first).

    Example:
        GET /api/v1/meals?house_id=uuid&user_id=uuid&from_date=2026-01-01T00:00:00Z&to_date=2026-01-15T23:59:59Z
    """
    try:
        meals_list, total = get_meals(
            db=db,
            house_id=house_id,
            user_id=user_id,
            meal_type=meal_type,
            recipe_id=recipe_id,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset
        )

        # Convert to list items with recipe names
        meal_items = []
        for meal in meals_list:
            # Get recipe name if meal is from recipe
            recipe_name = None
            if meal.recipe_id:
                recipe = db.query(Recipe).filter(Recipe.id == meal.recipe_id).first()
                if recipe:
                    recipe_name = recipe.name

            meal_items.append(
                MealListItem(
                    id=meal.id,
                    user_id=meal.user_id,
                    meal_type=meal.meal_type,
                    consumed_at=meal.consumed_at,
                    recipe_id=meal.recipe_id,
                    recipe_name=recipe_name,
                    calories=float(meal.calories) if meal.calories else None,
                    proteins_g=float(meal.proteins_g) if meal.proteins_g else None,
                    fats_g=float(meal.fats_g) if meal.fats_g else None,
                    carbs_g=float(meal.carbs_g) if meal.carbs_g else None,
                    notes=meal.notes,
                    created_at=meal.created_at
                )
            )

        return MealListResponse(
            meals=meal_items,
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching meals: {str(e)}"
        )


@router.get("/{meal_id}", response_model=MealDetailResponse)
def get_meal_details(
    meal_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db)
):
    """
    Get detailed meal information.

    Path Parameters:
        - meal_id: UUID of meal to retrieve

    Query Parameters:
        - house_id: House ID (required for security check)

    Returns:
        MealDetailResponse with:
            - Full meal information
            - Recipe details if meal was from recipe
            - Ingredients if free meal
            - Nutritional values

    Errors:
        404 Not Found: Meal not found or doesn't belong to house

    Example:
        GET /api/v1/meals/{meal_id}?house_id=uuid
    """
    meal = get_meal_by_id(db, meal_id, house_id)

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal {meal_id} not found in house {house_id}"
        )

    # Get recipe info if meal is from recipe
    recipe_name = None
    recipe_description = None
    if meal.recipe_id:
        recipe = db.query(Recipe).filter(Recipe.id == meal.recipe_id).first()
        if recipe:
            recipe_name = recipe.name
            recipe_description = recipe.description

    # Convert ingredients JSONB to schema format
    from app.schemas.recipe import RecipeIngredient
    ingredients = None
    if meal.ingredients:
        ingredients = [
            RecipeIngredient(
                food_id=UUID(ing["food_id"]),
                food_name=ing["food_name"],
                quantity_g=ing["quantity_g"]
            )
            for ing in meal.ingredients
        ]

    return MealDetailResponse(
        id=meal.id,
        user_id=meal.user_id,
        house_id=meal.house_id,
        recipe_id=meal.recipe_id,
        meal_type=meal.meal_type,
        ingredients=ingredients,
        quantity_grams=float(meal.quantity_grams) if meal.quantity_grams else None,
        calories=float(meal.calories) if meal.calories else None,
        proteins_g=float(meal.proteins_g) if meal.proteins_g else None,
        fats_g=float(meal.fats_g) if meal.fats_g else None,
        carbs_g=float(meal.carbs_g) if meal.carbs_g else None,
        consumed_at=meal.consumed_at,
        notes=meal.notes,
        created_at=meal.created_at,
        updated_at=meal.updated_at,
        recipe_name=recipe_name,
        recipe_description=recipe_description
    )


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_meal(
    meal_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a meal.

    Path Parameters:
        - meal_id: UUID of meal to delete

    Query Parameters:
        - house_id: House ID (required for security check)

    Authentication:
        Requires valid JWT token.
        User can only delete their own meals (or house owner can delete any).

    Returns:
        204 No Content on success

    Errors:
        401 Unauthorized: Missing or invalid authentication
        403 Forbidden: User doesn't have permission to delete this meal
        404 Not Found: Meal not found or doesn't belong to house
        500 Internal Server Error: Database error

    Example:
        DELETE /api/v1/meals/{meal_id}?house_id=uuid
    """
    # Placeholder until auth is fully implemented
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Meal deletion requires authentication. Complete auth implementation first."
    )

    # Future implementation:
    # try:
    #     # Get meal to check ownership
    #     meal = get_meal_by_id(db, meal_id, house_id)
    #     if not meal:
    #         raise HTTPException(
    #             status_code=status.HTTP_404_NOT_FOUND,
    #             detail=f"Meal {meal_id} not found in house {house_id}"
    #         )
    #
    #     # Check permission: user owns meal OR user is house owner
    #     if meal.user_id != current_user.id:
    #         # Check if user is house owner (TODO: when house ownership is implemented)
    #         raise HTTPException(
    #             status_code=status.HTTP_403_FORBIDDEN,
    #             detail="You can only delete your own meals"
    #         )
    #
    #     deleted = delete_meal(db=db, meal_id=meal_id, house_id=house_id)
    #
    #     if not deleted:
    #         raise HTTPException(
    #             status_code=status.HTTP_404_NOT_FOUND,
    #             detail=f"Meal {meal_id} not found"
    #         )
    #
    #     return None  # 204 No Content
    # except HTTPException:
    #     raise
    # except Exception as e:
    #     raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@router.get("/summary/daily")
def get_daily_summary(
    user_id: UUID = Query(..., description="User ID"),
    house_id: UUID = Query(..., description="House ID for security"),
    date: datetime = Query(..., description="Date to analyze (ISO format)"),
    db: Session = Depends(get_db)
):
    """
    Get nutritional summary for a specific day.

    Query Parameters:
        - user_id: User ID to analyze
        - house_id: House ID for security
        - date: Date to analyze (time part is ignored)

    Returns:
        Daily nutrition summary with:
            - Total calories, proteins, fats, carbs for the day
            - Meal count
            - Breakdown by meal type

    Example:
        GET /api/v1/meals/summary/daily?user_id=uuid&house_id=uuid&date=2026-01-15T00:00:00Z
    """
    try:
        summary = get_daily_nutrition_summary(
            db=db,
            user_id=user_id,
            house_id=house_id,
            date=date
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating daily summary: {str(e)}"
        )


@router.get("/summary/period")
def get_period_summary(
    user_id: UUID = Query(..., description="User ID"),
    house_id: UUID = Query(..., description="House ID for security"),
    from_date: datetime = Query(..., description="Start date (ISO format)"),
    to_date: datetime = Query(..., description="End date (ISO format)"),
    db: Session = Depends(get_db)
):
    """
    Get nutritional summary for a time period.

    Query Parameters:
        - user_id: User ID to analyze
        - house_id: House ID for security
        - from_date: Start of period
        - to_date: End of period

    Returns:
        Period nutrition summary with:
            - Total and average nutrition per day
            - Meal count
            - Breakdown by meal type

    Example:
        GET /api/v1/meals/summary/period?user_id=uuid&house_id=uuid&from_date=2026-01-01T00:00:00Z&to_date=2026-01-15T23:59:59Z
    """
    try:
        summary = get_period_nutrition_summary(
            db=db,
            user_id=user_id,
            house_id=house_id,
            from_date=from_date,
            to_date=to_date
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating period summary: {str(e)}"
        )
