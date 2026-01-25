"""
Meal Service
Business logic for meal-related operations.

This service provides reusable functions for:
    - Creating, reading, updating, deleting meals
    - Recording meals from recipes or free ingredients
    - Calculating nutritional values for consumed meals
    - Querying meal history with filters
    - Generating nutritional summaries and statistics

Separating business logic from API routes improves:
    - Code reusability
    - Testability
    - Maintainability
    - Clear separation of concerns
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from app.models.meal import Meal
from app.models.recipe import Recipe
from app.schemas.meal import MealCreate, MealUpdate
from app.services.nutrition import calculate_primary_macros, validate_ingredients


# ============================================================================
# MEAL CRUD FUNCTIONS
# ============================================================================

def create_meal(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    meal_data: MealCreate
) -> Meal:
    """
    Create a new meal record.

    Meals can be created in two ways:
    1. From a recipe: Provide recipe_id, inherit ingredients and nutrition from recipe
    2. Free meal: Provide ingredients list, calculate nutrition from ingredients

    Args:
        db: Database session
        user_id: ID of user who consumed the meal
        house_id: ID of house the user belongs to
        meal_data: Meal data from request (validated Pydantic model)

    Returns:
        Meal: Created meal record with calculated nutrition

    Raises:
        ValueError: If recipe not found, or ingredients are invalid

    Example (from recipe):
        meal = create_meal(
            db=db,
            user_id=current_user.id,
            house_id=current_house.id,
            meal_data=MealCreate(
                recipe_id="uuid-of-recipe",
                meal_type="pranzo",
                consumed_at=datetime.now()
            )
        )

    Example (free meal):
        meal = create_meal(
            db=db,
            user_id=current_user.id,
            house_id=current_house.id,
            meal_data=MealCreate(
                meal_type="cena",
                ingredients=[
                    {"food_id": "uuid", "food_name": "Pollo", "quantity_g": 150},
                    {"food_id": "uuid", "food_name": "Riso", "quantity_g": 80}
                ],
                consumed_at=datetime.now()
            )
        )
    """
    nutrition = {}
    ingredients_jsonb = None
    quantity_grams = meal_data.quantity_grams

    # Case 1: Meal from recipe
    if meal_data.recipe_id:
        # Look up recipe
        recipe = db.query(Recipe).filter(
            and_(
                Recipe.id == meal_data.recipe_id,
                Recipe.house_id == house_id  # Security check
            )
        ).first()

        if not recipe:
            raise ValueError(f"Recipe {meal_data.recipe_id} not found in house {house_id}")

        # Use recipe's nutrition
        # If quantity_grams is provided and differs from recipe total, scale nutrition
        # For simplicity in MVP, we use recipe nutrition as-is
        # TODO: Add portion scaling in future version
        nutrition = {
            "calories": float(recipe.total_calories or 0),
            "proteins_g": float(recipe.total_proteins_g or 0),
            "fats_g": float(recipe.total_fats_g or 0),
            "carbs_g": float(recipe.total_carbs_g or 0)
        }

        # Calculate total quantity from recipe if not provided
        if not quantity_grams:
            quantity_grams = sum(ing.get("quantity_g", 0) for ing in recipe.ingredients)

    # Case 2: Free meal (manual ingredients)
    else:
        if not meal_data.ingredients:
            raise ValueError("Must provide ingredients for free meal")

        # Validate ingredients
        ingredients_list = [ing.model_dump() for ing in meal_data.ingredients]
        is_valid, errors = validate_ingredients(ingredients_list, db)
        if not is_valid:
            raise ValueError(f"Invalid ingredients: {'; '.join(errors)}")

        # Calculate nutrition from ingredients
        nutrition = calculate_primary_macros(ingredients_list, db)

        # Convert ingredients to JSONB format
        ingredients_jsonb = [
            {
                "food_id": str(ing.food_id),
                "food_name": ing.food_name,
                "quantity_g": ing.quantity_g
            }
            for ing in meal_data.ingredients
        ]

        # Calculate total quantity if not provided
        if not quantity_grams:
            quantity_grams = sum(ing["quantity_g"] for ing in ingredients_jsonb)

    # Create meal record
    db_meal = Meal(
        user_id=user_id,
        house_id=house_id,
        recipe_id=meal_data.recipe_id,
        meal_type=meal_data.meal_type,
        ingredients=ingredients_jsonb,
        quantity_grams=quantity_grams,
        calories=nutrition.get("calories"),
        proteins_g=nutrition.get("proteins_g"),
        fats_g=nutrition.get("fats_g"),
        carbs_g=nutrition.get("carbs_g"),
        consumed_at=meal_data.consumed_at,
        notes=meal_data.notes
    )

    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)

    return db_meal


def get_meals(
    db: Session,
    house_id: UUID,
    user_id: Optional[UUID] = None,
    meal_type: Optional[str] = None,
    recipe_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> tuple[List[Meal], int]:
    """
    Get list of meals with filters.

    Args:
        db: Database session
        house_id: House ID (required for multi-tenant isolation)
        user_id: Optional user ID to filter by specific user
        meal_type: Optional meal type filter (colazione, spuntino, pranzo, cena)
        recipe_id: Optional recipe ID to find meals from specific recipe
        from_date: Optional start date for date range filter
        to_date: Optional end date for date range filter
        limit: Maximum number of results (default 100)
        offset: Number of results to skip (default 0)

    Returns:
        tuple: (list of Meal objects, total count)

    Example:
        meals, total = get_meals(
            db=db,
            house_id=house.id,
            user_id=user.id,
            meal_type="pranzo",
            from_date=datetime(2026, 1, 1),
            to_date=datetime.now(),
            limit=50
        )
    """
    # Build query with house filter
    query = db.query(Meal).filter(Meal.house_id == house_id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Meal.user_id == user_id)

    # Filter by meal type
    if meal_type:
        query = query.filter(Meal.meal_type == meal_type.lower())

    # Filter by recipe
    if recipe_id:
        query = query.filter(Meal.recipe_id == recipe_id)

    # Filter by date range
    if from_date:
        query = query.filter(Meal.consumed_at >= from_date)
    if to_date:
        query = query.filter(Meal.consumed_at <= to_date)

    # Get total count before pagination
    total = query.count()

    # Apply ordering (most recent first) and pagination
    meals = query.order_by(desc(Meal.consumed_at)).limit(limit).offset(offset).all()

    return meals, total


def get_meal_by_id(db: Session, meal_id: UUID, house_id: UUID) -> Optional[Meal]:
    """
    Get a single meal by ID.

    Args:
        db: Database session
        meal_id: Meal ID
        house_id: House ID for multi-tenant security check

    Returns:
        Meal or None if not found or belongs to different house

    Security:
        Always verify house_id to prevent accessing other houses' meals.
    """
    return db.query(Meal).filter(
        and_(
            Meal.id == meal_id,
            Meal.house_id == house_id
        )
    ).first()


def update_meal(
    db: Session,
    meal_id: UUID,
    house_id: UUID,
    meal_data: MealUpdate
) -> Optional[Meal]:
    """
    Update an existing meal.

    Args:
        db: Database session
        meal_id: Meal ID to update
        house_id: House ID for security verification
        meal_data: Updated meal data (partial update allowed)

    Returns:
        Updated Meal or None if not found

    Note:
        Only provided fields are updated (partial update).
        Nutrition is NOT recalculated - use delete + create for that.
    """
    # Get existing meal
    db_meal = get_meal_by_id(db, meal_id, house_id)
    if not db_meal:
        return None

    # Update only provided fields
    update_data = meal_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_meal, field, value)

    db.commit()
    db.refresh(db_meal)

    return db_meal


def delete_meal(db: Session, meal_id: UUID, house_id: UUID) -> bool:
    """
    Delete a meal.

    Args:
        db: Database session
        meal_id: Meal ID to delete
        house_id: House ID for security verification

    Returns:
        bool: True if deleted, False if not found

    Security:
        Verifies house_id before deletion to prevent unauthorized deletions.
    """
    db_meal = get_meal_by_id(db, meal_id, house_id)
    if not db_meal:
        return False

    db.delete(db_meal)
    db.commit()

    return True


# ============================================================================
# MEAL ANALYTICS AND STATISTICS FUNCTIONS
# ============================================================================

def get_daily_nutrition_summary(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    date: datetime
) -> dict:
    """
    Get nutritional summary for a specific day.

    Args:
        db: Database session
        user_id: User ID
        house_id: House ID
        date: Date to analyze (time part is ignored)

    Returns:
        Dictionary with daily nutrition totals:
            - date: The analyzed date
            - total_calories: Total calories consumed
            - total_proteins_g: Total protein
            - total_fats_g: Total fat
            - total_carbs_g: Total carbs
            - meal_count: Number of meals
            - by_meal_type: Breakdown by meal type

    Example:
        summary = get_daily_nutrition_summary(db, user_id, house_id, date.today())
        # {
        #     "date": "2026-01-15",
        #     "total_calories": 1850.5,
        #     "total_proteins_g": 120.3,
        #     "total_fats_g": 65.2,
        #     "total_carbs_g": 210.5,
        #     "meal_count": 4,
        #     "by_meal_type": {
        #         "colazione": {"calories": 400, ...},
        #         "pranzo": {"calories": 650, ...},
        #         ...
        #     }
        # }
    """
    # Get start and end of day
    start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)

    # Get all meals for the day
    meals, meal_count = get_meals(
        db=db,
        house_id=house_id,
        user_id=user_id,
        from_date=start_of_day,
        to_date=end_of_day,
        limit=1000  # Get all meals for the day
    )

    # Calculate totals
    total_calories = sum(float(m.calories or 0) for m in meals)
    total_proteins = sum(float(m.proteins_g or 0) for m in meals)
    total_fats = sum(float(m.fats_g or 0) for m in meals)
    total_carbs = sum(float(m.carbs_g or 0) for m in meals)

    # Group by meal type
    by_meal_type = {}
    for meal in meals:
        meal_type = meal.meal_type or "other"
        if meal_type not in by_meal_type:
            by_meal_type[meal_type] = {
                "calories": 0,
                "proteins_g": 0,
                "fats_g": 0,
                "carbs_g": 0,
                "count": 0
            }

        by_meal_type[meal_type]["calories"] += float(meal.calories or 0)
        by_meal_type[meal_type]["proteins_g"] += float(meal.proteins_g or 0)
        by_meal_type[meal_type]["fats_g"] += float(meal.fats_g or 0)
        by_meal_type[meal_type]["carbs_g"] += float(meal.carbs_g or 0)
        by_meal_type[meal_type]["count"] += 1

    return {
        "date": start_of_day.date().isoformat(),
        "total_calories": round(total_calories, 2),
        "total_proteins_g": round(total_proteins, 2),
        "total_fats_g": round(total_fats, 2),
        "total_carbs_g": round(total_carbs, 2),
        "meal_count": meal_count,
        "by_meal_type": by_meal_type
    }


def get_period_nutrition_summary(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    from_date: datetime,
    to_date: datetime
) -> dict:
    """
    Get nutritional summary for a time period (week, month, etc.).

    Args:
        db: Database session
        user_id: User ID
        house_id: House ID
        from_date: Start of period
        to_date: End of period

    Returns:
        Dictionary with period nutrition summary including averages

    Example:
        # Get weekly summary
        week_ago = datetime.now() - timedelta(days=7)
        summary = get_period_nutrition_summary(
            db, user_id, house_id,
            from_date=week_ago,
            to_date=datetime.now()
        )
    """
    # Get all meals for the period
    meals, total_meals = get_meals(
        db=db,
        house_id=house_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        limit=10000  # Get all meals in period
    )

    if not meals:
        return {
            "period_start": from_date.isoformat(),
            "period_end": to_date.isoformat(),
            "total_meals": 0,
            "total_calories": 0,
            "total_proteins_g": 0,
            "total_fats_g": 0,
            "total_carbs_g": 0,
            "avg_calories_per_day": 0,
            "avg_proteins_per_day": 0,
            "avg_fats_per_day": 0,
            "avg_carbs_per_day": 0,
            "by_meal_type": {}
        }

    # Calculate totals
    total_calories = sum(float(m.calories or 0) for m in meals)
    total_proteins = sum(float(m.proteins_g or 0) for m in meals)
    total_fats = sum(float(m.fats_g or 0) for m in meals)
    total_carbs = sum(float(m.carbs_g or 0) for m in meals)

    # Calculate number of days in period
    days_in_period = (to_date - from_date).days + 1

    # Calculate averages per day
    avg_calories = total_calories / days_in_period if days_in_period > 0 else 0
    avg_proteins = total_proteins / days_in_period if days_in_period > 0 else 0
    avg_fats = total_fats / days_in_period if days_in_period > 0 else 0
    avg_carbs = total_carbs / days_in_period if days_in_period > 0 else 0

    # Group by meal type
    by_meal_type = {}
    for meal in meals:
        meal_type = meal.meal_type or "other"
        if meal_type not in by_meal_type:
            by_meal_type[meal_type] = {
                "total_calories": 0,
                "total_proteins_g": 0,
                "total_fats_g": 0,
                "total_carbs_g": 0,
                "count": 0
            }

        by_meal_type[meal_type]["total_calories"] += float(meal.calories or 0)
        by_meal_type[meal_type]["total_proteins_g"] += float(meal.proteins_g or 0)
        by_meal_type[meal_type]["total_fats_g"] += float(meal.fats_g or 0)
        by_meal_type[meal_type]["total_carbs_g"] += float(meal.carbs_g or 0)
        by_meal_type[meal_type]["count"] += 1

    return {
        "period_start": from_date.isoformat(),
        "period_end": to_date.isoformat(),
        "total_meals": total_meals,
        "total_calories": round(total_calories, 2),
        "total_proteins_g": round(total_proteins, 2),
        "total_fats_g": round(total_fats, 2),
        "total_carbs_g": round(total_carbs, 2),
        "avg_calories_per_day": round(avg_calories, 2),
        "avg_proteins_per_day": round(avg_proteins, 2),
        "avg_fats_per_day": round(avg_fats, 2),
        "avg_carbs_per_day": round(avg_carbs, 2),
        "by_meal_type": by_meal_type
    }


def get_most_consumed_recipes(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    limit: int = 10,
    days: Optional[int] = None
) -> List[dict]:
    """
    Get most frequently consumed recipes.

    Args:
        db: Database session
        user_id: User ID
        house_id: House ID
        limit: Number of top recipes to return
        days: Optional number of days to look back (None = all time)

    Returns:
        List of dictionaries with recipe info and consumption count

    Example:
        top_recipes = get_most_consumed_recipes(db, user_id, house_id, limit=5, days=30)
        # [
        #     {"recipe_id": "uuid", "recipe_name": "Pasta", "count": 8},
        #     {"recipe_id": "uuid", "recipe_name": "Chicken", "count": 6},
        #     ...
        # ]
    """
    query = db.query(
        Meal.recipe_id,
        func.count(Meal.id).label('count')
    ).filter(
        and_(
            Meal.user_id == user_id,
            Meal.house_id == house_id,
            Meal.recipe_id.isnot(None)  # Only meals from recipes
        )
    )

    # Apply date filter if specified
    if days:
        cutoff_date = datetime.now() - timedelta(days=days)
        query = query.filter(Meal.consumed_at >= cutoff_date)

    # Group by recipe and order by count
    results = query.group_by(Meal.recipe_id).order_by(desc('count')).limit(limit).all()

    # Enrich with recipe names
    output = []
    for recipe_id, count in results:
        recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
        output.append({
            "recipe_id": str(recipe_id),
            "recipe_name": recipe.name if recipe else "Unknown",
            "count": count
        })

    return output
