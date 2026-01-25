"""
Recipe Service
Business logic for recipe-related operations.

This service provides reusable functions for:
    - Creating, reading, updating, deleting recipes
    - Calculating and storing nutritional values
    - Filtering and searching recipes
    - Validating recipe data
    - Managing recipe ingredients

Separating business logic from API routes improves:
    - Code reusability
    - Testability
    - Maintainability
    - Clear separation of concerns
"""

from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate, RecipeUpdate, RecipeIngredient
from app.services.nutrition import (
    calculate_primary_macros,
    validate_ingredients,
    get_ingredient_nutrition_breakdown
)


# ============================================================================
# RECIPE CRUD FUNCTIONS
# ============================================================================

def create_recipe(
    db: Session,
    house_id: UUID,
    created_by: UUID,
    recipe_data: RecipeCreate
) -> Recipe:
    """
    Create a new recipe with calculated nutritional values.

    This function:
    1. Validates all ingredients exist in foods database
    2. Calculates nutritional totals from ingredients
    3. Creates recipe record with all data
    4. Returns the created recipe

    Args:
        db: Database session
        house_id: ID of house this recipe belongs to
        created_by: ID of user creating the recipe
        recipe_data: Recipe data from request (validated Pydantic model)

    Returns:
        Recipe: Created recipe record with calculated nutrition

    Raises:
        ValueError: If ingredients are invalid or not found in database

    Example:
        recipe = create_recipe(
            db=db,
            house_id=current_house.id,
            created_by=current_user.id,
            recipe_data=RecipeCreate(
                name="Pasta al Pomodoro",
                ingredients=[
                    {"food_id": "uuid", "food_name": "Pasta", "quantity_g": 100},
                    {"food_id": "uuid", "food_name": "Pomodori", "quantity_g": 200}
                ],
                difficulty="easy"
            )
        )
    """
    # Step 1: Validate ingredients exist in database
    ingredients_list = [ing.model_dump() for ing in recipe_data.ingredients]
    is_valid, errors = validate_ingredients(ingredients_list, db)
    if not is_valid:
        raise ValueError(f"Invalid ingredients: {'; '.join(errors)}")

    # Step 2: Calculate nutritional values from ingredients
    nutrition = calculate_primary_macros(ingredients_list, db)

    # Step 3: Convert ingredients to JSONB format for storage
    ingredients_jsonb = [
        {
            "food_id": str(ing.food_id),
            "food_name": ing.food_name,
            "quantity": ing.quantity,
            "unit": ing.unit,
            "quantity_g": ing.quantity_g
        }
        for ing in recipe_data.ingredients
    ]

    # Step 4: Create recipe record
    db_recipe = Recipe(
        house_id=house_id,
        created_by=created_by,
        name=recipe_data.name,
        description=recipe_data.description,
        procedure=recipe_data.procedure,
        ingredients=ingredients_jsonb,
        preparation_time_min=recipe_data.preparation_time_min,
        difficulty=recipe_data.difficulty,
        tags=recipe_data.tags,
        # Calculated nutritional values
        total_calories=nutrition["calories"],
        total_proteins_g=nutrition["proteins_g"],
        total_fats_g=nutrition["fats_g"],
        total_carbs_g=nutrition["carbs_g"]
    )

    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)

    return db_recipe


def get_recipes(
    db: Session,
    house_id: UUID,
    search: Optional[str] = None,
    difficulty: Optional[str] = None,
    tags: Optional[List[str]] = None,
    limit: int = 100,
    offset: int = 0
) -> tuple[List[Recipe], int]:
    """
    Get list of recipes with filters.

    Args:
        db: Database session
        house_id: House ID (required for multi-tenant isolation)
        search: Optional search term for recipe name
        difficulty: Optional difficulty filter (easy, medium, hard)
        tags: Optional list of tags to filter by (recipes must have ALL tags)
        limit: Maximum number of results (default 100)
        offset: Number of results to skip (default 0)

    Returns:
        tuple: (list of Recipe objects, total count)

    Example:
        recipes, total = get_recipes(
            db=db,
            house_id=house.id,
            search="pasta",
            difficulty="easy",
            tags=["vegetariano"],
            limit=20,
            offset=0
        )
    """
    # Build query with house filter
    query = db.query(Recipe).filter(Recipe.house_id == house_id)

    # Apply search filter on name
    if search:
        query = query.filter(Recipe.name.ilike(f"%{search}%"))

    # Filter by difficulty
    if difficulty:
        query = query.filter(Recipe.difficulty == difficulty.lower())

    # Filter by tags (recipe must have ALL specified tags)
    if tags:
        for tag in tags:
            # PostgreSQL JSONB contains operator
            query = query.filter(Recipe.tags.contains([tag.lower()]))

    # Get total count before pagination
    total = query.count()

    # Apply ordering (most recent first) and pagination
    recipes = query.order_by(desc(Recipe.created_at)).limit(limit).offset(offset).all()

    return recipes, total


def get_recipe_by_id(db: Session, recipe_id: UUID, house_id: UUID) -> Optional[Recipe]:
    """
    Get a single recipe by ID.

    Args:
        db: Database session
        recipe_id: Recipe ID
        house_id: House ID for multi-tenant security check

    Returns:
        Recipe or None if not found or belongs to different house

    Security:
        Always verify house_id to prevent accessing other houses' recipes.
    """
    return db.query(Recipe).filter(
        and_(
            Recipe.id == recipe_id,
            Recipe.house_id == house_id
        )
    ).first()


def update_recipe(
    db: Session,
    recipe_id: UUID,
    house_id: UUID,
    recipe_data: RecipeUpdate
) -> Optional[Recipe]:
    """
    Update an existing recipe.

    If ingredients are updated, nutritional values are recalculated.
    Otherwise, only the provided fields are updated.

    Args:
        db: Database session
        recipe_id: Recipe ID to update
        house_id: House ID for security verification
        recipe_data: Updated recipe data (partial update allowed)

    Returns:
        Updated Recipe or None if not found

    Raises:
        ValueError: If updated ingredients are invalid

    Note:
        Only provided fields are updated (partial update).
        If ingredients change, nutrition is recalculated automatically.
    """
    # Get existing recipe
    db_recipe = get_recipe_by_id(db, recipe_id, house_id)
    if not db_recipe:
        return None

    # Get update data (only fields that were provided)
    update_data = recipe_data.model_dump(exclude_unset=True)

    # Check if ingredients are being updated
    if "ingredients" in update_data:
        # Validate new ingredients
        ingredients_list = [ing.model_dump() for ing in recipe_data.ingredients]
        is_valid, errors = validate_ingredients(ingredients_list, db)
        if not is_valid:
            raise ValueError(f"Invalid ingredients: {'; '.join(errors)}")

        # Recalculate nutrition with new ingredients
        nutrition = calculate_primary_macros(ingredients_list, db)

        # Convert ingredients to JSONB format
        ingredients_jsonb = [
            {
                "food_id": str(ing.food_id),
                "food_name": ing.food_name,
                "quantity": ing.quantity,
                "unit": ing.unit,
                "quantity_g": ing.quantity_g
            }
            for ing in recipe_data.ingredients
        ]

        # Update ingredients and nutrition
        update_data["ingredients"] = ingredients_jsonb
        update_data["total_calories"] = nutrition["calories"]
        update_data["total_proteins_g"] = nutrition["proteins_g"]
        update_data["total_fats_g"] = nutrition["fats_g"]
        update_data["total_carbs_g"] = nutrition["carbs_g"]

    # Apply all updates
    for field, value in update_data.items():
        setattr(db_recipe, field, value)

    db.commit()
    db.refresh(db_recipe)

    return db_recipe


def delete_recipe(db: Session, recipe_id: UUID, house_id: UUID) -> bool:
    """
    Delete a recipe.

    Args:
        db: Database session
        recipe_id: Recipe ID to delete
        house_id: House ID for security verification

    Returns:
        bool: True if deleted, False if not found

    Security:
        Verifies house_id before deletion to prevent unauthorized deletions.

    Note:
        Related meals will have their recipe_id set to NULL (ON DELETE SET NULL).
        The meal records are preserved for nutritional tracking history.
    """
    db_recipe = get_recipe_by_id(db, recipe_id, house_id)
    if not db_recipe:
        return False

    db.delete(db_recipe)
    db.commit()

    return True


# ============================================================================
# RECIPE UTILITY FUNCTIONS
# ============================================================================

def get_recipe_with_ingredient_nutrition(
    db: Session,
    recipe_id: UUID,
    house_id: UUID
) -> Optional[dict]:
    """
    Get recipe with detailed per-ingredient nutritional breakdown.

    This function returns a recipe with each ingredient's individual
    nutritional contribution, useful for detailed recipe views.

    Args:
        db: Database session
        recipe_id: Recipe ID
        house_id: House ID for security

    Returns:
        Dictionary with recipe data and ingredient breakdown, or None if not found

    Example:
        {
            "recipe": <Recipe object>,
            "ingredient_breakdown": [
                {
                    "food_id": "uuid",
                    "food_name": "Chicken",
                    "quantity_g": 150,
                    "calories": 165,
                    "proteins_g": 34.5,
                    ...
                },
                ...
            ]
        }
    """
    recipe = get_recipe_by_id(db, recipe_id, house_id)
    if not recipe:
        return None

    # Get nutritional breakdown per ingredient
    breakdown = get_ingredient_nutrition_breakdown(recipe.ingredients, db)

    return {
        "recipe": recipe,
        "ingredient_breakdown": breakdown
    }


def search_recipes_by_ingredient(
    db: Session,
    house_id: UUID,
    food_id: UUID,
    limit: int = 100
) -> List[Recipe]:
    """
    Find all recipes that contain a specific ingredient.

    Useful for:
        - "What can I make with this ingredient?"
        - Ingredient usage tracking
        - Grocy integration (find recipes using available items)

    Args:
        db: Database session
        house_id: House ID
        food_id: Food ID to search for in ingredients
        limit: Maximum results

    Returns:
        List of Recipe objects containing the ingredient

    Example:
        recipes = search_recipes_by_ingredient(db, house_id, chicken_food_id)
    """
    # Use PostgreSQL JSONB query to find recipes containing this food_id
    # The @> operator checks if the left JSONB contains the right JSONB
    return db.query(Recipe).filter(
        and_(
            Recipe.house_id == house_id,
            Recipe.ingredients.op('@>')(
                f'[{{"food_id": "{str(food_id)}"}}]'
            )
        )
    ).limit(limit).all()


def get_popular_recipes(
    db: Session,
    house_id: UUID,
    limit: int = 10
) -> List[dict]:
    """
    Get most popular recipes (based on usage in meals).

    This requires a join with the meals table to count how many times
    each recipe has been used.

    Args:
        db: Database session
        house_id: House ID
        limit: Number of top recipes to return

    Returns:
        List of dictionaries with recipe and usage count

    Example:
        [
            {"recipe": <Recipe>, "usage_count": 15},
            {"recipe": <Recipe>, "usage_count": 12},
            ...
        ]

    Note:
        This function will be fully implemented once Meal model is available.
        For now, it returns recipes sorted by creation date.
    """
    # TODO: Implement actual popularity count once Meal model relationship is set up
    # For now, return most recently created recipes
    recipes = db.query(Recipe).filter(
        Recipe.house_id == house_id
    ).order_by(desc(Recipe.created_at)).limit(limit).all()

    return [{"recipe": recipe, "usage_count": 0} for recipe in recipes]


def get_recipes_by_tags(
    db: Session,
    house_id: UUID,
    tags: List[str],
    match_any: bool = False,
    limit: int = 100
) -> List[Recipe]:
    """
    Get recipes filtered by multiple tags.

    Args:
        db: Database session
        house_id: House ID
        tags: List of tags to filter by
        match_any: If True, match recipes with ANY tag (OR logic)
                  If False, match recipes with ALL tags (AND logic)
        limit: Maximum results

    Returns:
        List of Recipe objects

    Example:
        # Get vegetarian AND quick recipes
        recipes = get_recipes_by_tags(
            db, house_id,
            tags=["vegetariano", "veloce"],
            match_any=False
        )

        # Get recipes that are either comfort OR estivo
        recipes = get_recipes_by_tags(
            db, house_id,
            tags=["comfort", "estivo"],
            match_any=True
        )
    """
    query = db.query(Recipe).filter(Recipe.house_id == house_id)

    if match_any:
        # Match recipes that have ANY of the tags (OR logic)
        # Use JSONB overlap operator ?|
        query = query.filter(Recipe.tags.op('?|')(tags))
    else:
        # Match recipes that have ALL tags (AND logic)
        for tag in tags:
            query = query.filter(Recipe.tags.contains([tag.lower()]))

    return query.limit(limit).all()


def get_recipe_stats(db: Session, house_id: UUID) -> dict:
    """
    Get statistics about recipes in a house.

    Returns:
        Dictionary with recipe statistics:
            - total_recipes: Total number of recipes
            - by_difficulty: Count grouped by difficulty
            - avg_prep_time: Average preparation time
            - most_used_tags: Most frequently used tags

    Example:
        stats = get_recipe_stats(db, house_id)
        # {
        #     "total_recipes": 45,
        #     "by_difficulty": {"easy": 20, "medium": 15, "hard": 10},
        #     "avg_prep_time": 32.5,
        #     "most_used_tags": [("veloce", 15), ("vegetariano", 12), ...]
        # }
    """
    # Total recipes
    total = db.query(Recipe).filter(Recipe.house_id == house_id).count()

    # Group by difficulty
    difficulty_counts = db.query(
        Recipe.difficulty,
        func.count(Recipe.id)
    ).filter(
        Recipe.house_id == house_id
    ).group_by(Recipe.difficulty).all()

    by_difficulty = {diff: count for diff, count in difficulty_counts if diff}

    # Average preparation time
    avg_prep_time = db.query(
        func.avg(Recipe.preparation_time_min)
    ).filter(
        and_(
            Recipe.house_id == house_id,
            Recipe.preparation_time_min.isnot(None)
        )
    ).scalar() or 0

    # Most used tags (requires JSONB unnesting - simplified version)
    # For full implementation, use PostgreSQL's jsonb_array_elements
    most_used_tags = []  # Placeholder - would need more complex query

    return {
        "total_recipes": total,
        "by_difficulty": by_difficulty,
        "avg_prep_time": round(float(avg_prep_time), 1) if avg_prep_time else 0,
        "most_used_tags": most_used_tags
    }
