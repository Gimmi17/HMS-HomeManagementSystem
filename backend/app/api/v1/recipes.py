"""
Recipes API Endpoints
Provides CRUD operations for recipes.

Endpoints:
    - POST /recipes - Create new recipe
    - GET /recipes - List recipes with filters
    - GET /recipes/{id} - Get single recipe details
    - PUT /recipes/{id} - Update recipe
    - DELETE /recipes/{id} - Delete recipe

All endpoints require authentication (except where noted).
Recipes belong to a house and are accessible to all house members.
"""

from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_house import UserHouse
from app.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeDetailResponse,
    RecipeListItem,
    RecipeListResponse
)
from app.services.recipe_service import (
    create_recipe,
    get_recipes,
    get_recipe_by_id,
    update_recipe,
    delete_recipe,
    get_recipe_with_ingredient_nutrition
)


def verify_house_membership(db: Session, user_id: UUID, house_id: UUID) -> UserHouse:
    """
    Verify that user belongs to the specified house.

    Args:
        db: Database session
        user_id: User ID to check
        house_id: House ID to verify membership

    Returns:
        UserHouse membership object

    Raises:
        HTTPException 403 if user is not a member of the house
    """
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non sei membro di questa casa"
        )

    return membership

# Create router for recipes endpoints
# Prefix will be added in main router: /api/v1/recipes
router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_new_recipe(
    recipe_data: RecipeCreate,
    house_id: UUID = Query(..., description="House ID to create recipe in"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new recipe.

    Creates a recipe with:
    - Ingredients list (validated against foods database)
    - Automatically calculated nutritional values
    - Associated with user's current house

    Query Parameters:
        - house_id: UUID of the house to create recipe in (required)

    Request Body:
        RecipeCreate schema with:
            - name: Recipe name (required)
            - ingredients: List of ingredients with food_id and quantity_g (min 1)
            - description, procedure, preparation_time_min, difficulty, tags (optional)

    Authentication:
        Requires valid JWT token in Authorization header.

    Returns:
        RecipeResponse with created recipe including calculated nutrition.

    Errors:
        400 Bad Request: Invalid ingredients or validation error
        401 Unauthorized: Missing or invalid authentication
        403 Forbidden: User is not a member of the house
        500 Internal Server Error: Database or calculation error
    """
    # Verify user belongs to the house
    membership = verify_house_membership(db, current_user.id, house_id)

    # Check if user can create recipes (OWNER or MEMBER)
    if not membership.can_create_recipes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per creare ricette in questa casa"
        )

    try:
        recipe = create_recipe(
            db=db,
            house_id=house_id,
            created_by=current_user.id,
            recipe_data=recipe_data
        )
        return recipe
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nella creazione della ricetta: {str(e)}"
        )


@router.get("", response_model=RecipeListResponse)
def list_recipes(
    house_id: UUID = Query(..., description="House ID to filter recipes"),
    search: Optional[str] = Query(None, description="Search recipe name"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty (easy, medium, hard)"),
    tags: Optional[List[str]] = Query(None, description="Filter by tags (AND logic)"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results (1-200)"),
    offset: int = Query(0, ge=0, description="Results to skip (pagination)"),
    db: Session = Depends(get_db)
):
    """
    List recipes with optional filters.

    Query Parameters:
        - house_id: House ID (required) - only recipes from this house
        - search: Search term for recipe name (case-insensitive)
        - difficulty: Filter by difficulty level (easy, medium, hard)
        - tags: Filter by tags (recipes must have ALL specified tags)
        - limit: Number of results per page (default 50, max 200)
        - offset: Skip first N results (for pagination)

    Returns:
        RecipeListResponse with:
            - recipes: List of recipes (simplified schema)
            - total: Total number of matching recipes
            - limit: Applied limit
            - offset: Applied offset

    Note:
        Authentication not required for MVP, but house_id must be provided.
        In production, house_id should be validated against user's houses.

    Example:
        GET /api/v1/recipes?house_id=uuid&search=pasta&difficulty=easy&limit=20
    """
    try:
        recipes_list, total = get_recipes(
            db=db,
            house_id=house_id,
            search=search,
            difficulty=difficulty,
            tags=tags,
            limit=limit,
            offset=offset
        )

        # Convert to list items with ingredient count
        recipe_items = [
            RecipeListItem(
                id=recipe.id,
                name=recipe.name,
                description=recipe.description,
                ingredient_count=len(recipe.ingredients) if recipe.ingredients else 0,
                preparation_time_min=recipe.preparation_time_min,
                difficulty=recipe.difficulty,
                tags=recipe.tags or [],
                total_calories=float(recipe.total_calories) if recipe.total_calories else None,
                total_proteins_g=float(recipe.total_proteins_g) if recipe.total_proteins_g else None,
                total_fats_g=float(recipe.total_fats_g) if recipe.total_fats_g else None,
                total_carbs_g=float(recipe.total_carbs_g) if recipe.total_carbs_g else None,
                created_at=recipe.created_at
            )
            for recipe in recipes_list
        ]

        return RecipeListResponse(
            recipes=recipe_items,
            total=total,
            limit=limit,
            offset=offset
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching recipes: {str(e)}"
        )


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe_details(
    recipe_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db)
):
    """
    Get detailed recipe information.

    Path Parameters:
        - recipe_id: UUID of recipe to retrieve

    Query Parameters:
        - house_id: House ID (required for security check)

    Returns:
        RecipeDetailResponse with:
            - Full recipe information
            - Per-ingredient nutritional breakdown
            - Total nutritional values

    Errors:
        404 Not Found: Recipe not found or doesn't belong to house

    Example:
        GET /api/v1/recipes/{recipe_id}?house_id=uuid
    """
    # Get recipe with detailed ingredient nutrition
    result = get_recipe_with_ingredient_nutrition(db, recipe_id, house_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe {recipe_id} not found in house {house_id}"
        )

    recipe = result["recipe"]
    ingredient_breakdown = result["ingredient_breakdown"]

    # Build a lookup of nutrition by food_id
    nutrition_by_food = {
        ing["food_id"]: ing for ing in ingredient_breakdown
    }

    # Merge stored ingredient data (quantity, unit) with calculated nutrition
    from app.schemas.recipe import RecipeIngredientWithNutrition
    ingredients_with_nutrition = []
    for stored_ing in (recipe.ingredients or []):
        food_id_str = str(stored_ing.get("food_id", ""))
        nutr = nutrition_by_food.get(food_id_str, {})
        ingredients_with_nutrition.append(
            RecipeIngredientWithNutrition(
                food_id=UUID(food_id_str) if food_id_str else None,
                food_name=stored_ing.get("food_name", ""),
                quantity=stored_ing.get("quantity", stored_ing.get("quantity_g", 0)),
                unit=stored_ing.get("unit", "g"),
                quantity_g=stored_ing.get("quantity_g", 0),
                calories=nutr.get("calories"),
                proteins_g=nutr.get("proteins_g"),
                fats_g=nutr.get("fats_g"),
                carbs_g=nutr.get("carbs_g"),
            )
        )

    # Build detailed response
    return RecipeDetailResponse(
        id=recipe.id,
        house_id=recipe.house_id,
        created_by=recipe.created_by,
        name=recipe.name,
        description=recipe.description,
        procedure=recipe.procedure,
        ingredients=ingredients_with_nutrition,
        preparation_time_min=recipe.preparation_time_min,
        difficulty=recipe.difficulty,
        tags=recipe.tags or [],
        total_calories=float(recipe.total_calories) if recipe.total_calories else None,
        total_proteins_g=float(recipe.total_proteins_g) if recipe.total_proteins_g else None,
        total_fats_g=float(recipe.total_fats_g) if recipe.total_fats_g else None,
        total_carbs_g=float(recipe.total_carbs_g) if recipe.total_carbs_g else None,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at
    )


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_existing_recipe(
    recipe_id: UUID,
    recipe_data: RecipeUpdate,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing recipe.

    Path Parameters:
        - recipe_id: UUID of recipe to update

    Query Parameters:
        - house_id: House ID (required for security check)

    Request Body:
        RecipeUpdate schema with optional fields:
            - Any field from RecipeCreate can be updated
            - Only provided fields are updated (partial update)
            - If ingredients change, nutrition is recalculated

    Authentication:
        Requires valid JWT token.

    Returns:
        RecipeResponse with updated recipe.

    Errors:
        400 Bad Request: Invalid ingredients or validation error
        401 Unauthorized: Missing or invalid authentication
        403 Forbidden: User is not a member of the house
        404 Not Found: Recipe not found or doesn't belong to house
        500 Internal Server Error: Database or calculation error
    """
    # Verify user belongs to the house
    membership = verify_house_membership(db, current_user.id, house_id)

    # Check if user can modify recipes
    if not membership.can_create_recipes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per modificare ricette in questa casa"
        )

    try:
        updated_recipe = update_recipe(
            db=db,
            recipe_id=recipe_id,
            house_id=house_id,
            recipe_data=recipe_data
        )

        if not updated_recipe:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ricetta non trovata"
            )

        return updated_recipe
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nell'aggiornamento della ricetta: {str(e)}"
        )


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_recipe(
    recipe_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a recipe.

    Path Parameters:
        - recipe_id: UUID of recipe to delete

    Query Parameters:
        - house_id: House ID (required for security check)

    Authentication:
        Requires valid JWT token.

    Returns:
        204 No Content on success

    Errors:
        401 Unauthorized: Missing or invalid authentication
        403 Forbidden: User is not a member of the house
        404 Not Found: Recipe not found or doesn't belong to house
        500 Internal Server Error: Database error

    Note:
        Meals created from this recipe will have recipe_id set to NULL.
        The meal records are preserved for historical tracking.
    """
    # Verify user belongs to the house
    membership = verify_house_membership(db, current_user.id, house_id)

    # Check if user can delete recipes
    if not membership.can_create_recipes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai i permessi per eliminare ricette in questa casa"
        )

    try:
        deleted = delete_recipe(db=db, recipe_id=recipe_id, house_id=house_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ricetta non trovata"
            )

        return None  # 204 No Content
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nell'eliminazione della ricetta: {str(e)}"
        )
