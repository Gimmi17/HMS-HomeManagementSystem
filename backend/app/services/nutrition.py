"""
Nutrition Service
Provides functions for calculating nutritional values from ingredients.

This service contains the core logic for:
    - Calculating total nutrition from a list of ingredients
    - Scaling nutritional values based on quantity
    - Validating ingredient food IDs exist in database
    - Computing macros and micronutrients

The nutrition calculation formula:
    For each ingredient:
        actual_nutrient = (food.nutrient_per_100g * ingredient.quantity_g) / 100
    total_nutrient = SUM(all ingredient actual_nutrients)

All nutritional values in the foods table are stored per 100g.
This service scales those values based on the actual quantity used.

Example:
    If Chicken has 23g protein per 100g, and we use 150g:
    actual_protein = (23 * 150) / 100 = 34.5g protein
"""

from typing import List, Dict, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.food import Food


def calculate_nutrition(
    ingredients: List[Dict],
    db: Session
) -> Dict[str, float]:
    """
    Calculate total nutritional values from a list of ingredients.

    This function:
    1. Looks up each ingredient's food in the database
    2. Scales the food's per-100g nutrients by the actual quantity
    3. Sums all nutrients across all ingredients
    4. Returns the total nutritional values

    Args:
        ingredients: List of ingredient dictionaries, each containing:
            - food_id (UUID): ID of the food from foods table
            - quantity_g (float): Quantity of this ingredient in grams
        db: Database session for querying foods

    Returns:
        Dictionary with calculated nutritional totals:
            {
                "calories": 450.5,
                "proteins_g": 35.2,
                "fats_g": 12.3,
                "carbs_g": 58.7,
                "fibers_g": 8.2,
                ... (additional nutrients if needed)
            }

    Example:
        ingredients = [
            {"food_id": "uuid-of-chicken", "quantity_g": 150.0},
            {"food_id": "uuid-of-rice", "quantity_g": 80.0}
        ]
        nutrition = calculate_nutrition(ingredients, db)
        # Returns: {
        #     "calories": 420.0,
        #     "proteins_g": 38.5,
        #     "fats_g": 6.2,
        #     "carbs_g": 58.3,
        #     "fibers_g": 1.5
        # }

    Notes:
        - If a food_id is not found, it's silently skipped (nutrients = 0)
        - If a nutrient field is NULL in database, it's treated as 0
        - All calculations use floats for precision
        - Result values are rounded to 2 decimal places
    """
    # Initialize totals for all nutrients we want to track
    totals = {
        "calories": 0.0,
        "proteins_g": 0.0,
        "fats_g": 0.0,
        "carbs_g": 0.0,
        "fibers_g": 0.0,
        "omega3_ala_g": 0.0,
        "omega6_g": 0.0,
        "calcium_g": 0.0,
        "iron_g": 0.0,
        "magnesium_g": 0.0,
        "potassium_g": 0.0,
        "zinc_g": 0.0,
        "vitamin_a_g": 0.0,
        "vitamin_c_g": 0.0,
        "vitamin_d_g": 0.0,
        "vitamin_e_g": 0.0,
        "vitamin_k_g": 0.0,
        "vitamin_b6_g": 0.0,
        "folate_b9_g": 0.0,
        "vitamin_b12_g": 0.0,
    }

    # Process each ingredient
    for ingredient in ingredients:
        food_id = ingredient.get("food_id")
        quantity_g = float(ingredient.get("quantity_g", 0))

        if not food_id or quantity_g <= 0:
            # Skip invalid ingredients
            continue

        # Look up food in database
        food = db.query(Food).filter(Food.id == food_id).first()
        if not food:
            # Food not found - skip this ingredient
            # In production, you might want to log this or raise an error
            continue

        # Calculate scaling ratio
        # Food nutrients are per 100g, so we scale by (quantity_g / 100)
        ratio = quantity_g / 100.0

        # Scale and sum each nutrient
        # Use getattr to safely get attributes, defaulting to 0 if None
        totals["calories"] += float(food.proteins_g or 0) * 4 + float(food.carbs_g or 0) * 4 + float(food.fats_g or 0) * 9  # Calorie calculation from macros
        totals["proteins_g"] += _safe_decimal_to_float(food.proteins_g) * ratio
        totals["fats_g"] += _safe_decimal_to_float(food.fats_g) * ratio
        totals["carbs_g"] += _safe_decimal_to_float(food.carbs_g) * ratio
        totals["fibers_g"] += _safe_decimal_to_float(food.fibers_g) * ratio

        # Essential fatty acids
        totals["omega3_ala_g"] += _safe_decimal_to_float(food.omega3_ala_g) * ratio
        totals["omega6_g"] += _safe_decimal_to_float(food.omega6_g) * ratio

        # Minerals
        totals["calcium_g"] += _safe_decimal_to_float(food.calcium_g) * ratio
        totals["iron_g"] += _safe_decimal_to_float(food.iron_g) * ratio
        totals["magnesium_g"] += _safe_decimal_to_float(food.magnesium_g) * ratio
        totals["potassium_g"] += _safe_decimal_to_float(food.potassium_g) * ratio
        totals["zinc_g"] += _safe_decimal_to_float(food.zinc_g) * ratio

        # Vitamins
        totals["vitamin_a_g"] += _safe_decimal_to_float(food.vitamin_a_g) * ratio
        totals["vitamin_c_g"] += _safe_decimal_to_float(food.vitamin_c_g) * ratio
        totals["vitamin_d_g"] += _safe_decimal_to_float(food.vitamin_d_g) * ratio
        totals["vitamin_e_g"] += _safe_decimal_to_float(food.vitamin_e_g) * ratio
        totals["vitamin_k_g"] += _safe_decimal_to_float(food.vitamin_k_g) * ratio
        totals["vitamin_b6_g"] += _safe_decimal_to_float(food.vitamin_b6_g) * ratio
        totals["folate_b9_g"] += _safe_decimal_to_float(food.folate_b9_g) * ratio
        totals["vitamin_b12_g"] += _safe_decimal_to_float(food.vitamin_b12_g) * ratio

    # Round all values to 2 decimal places for cleaner output
    return {key: round(value, 2) for key, value in totals.items()}


def calculate_primary_macros(
    ingredients: List[Dict],
    db: Session
) -> Dict[str, float]:
    """
    Calculate only the primary macronutrients (calories, protein, fat, carbs).

    This is a lighter version of calculate_nutrition that only computes
    the most commonly used nutritional values. Use this when you don't
    need the full micronutrient breakdown.

    Args:
        ingredients: List of ingredient dictionaries
        db: Database session

    Returns:
        Dictionary with primary macros:
            {
                "calories": 450.5,
                "proteins_g": 35.2,
                "fats_g": 12.3,
                "carbs_g": 58.7
            }

    Example:
        macros = calculate_primary_macros(ingredients, db)
    """
    totals = {
        "calories": 0.0,
        "proteins_g": 0.0,
        "fats_g": 0.0,
        "carbs_g": 0.0,
    }

    for ingredient in ingredients:
        food_id = ingredient.get("food_id")
        quantity_g = float(ingredient.get("quantity_g", 0))

        if not food_id or quantity_g <= 0:
            continue

        food = db.query(Food).filter(Food.id == food_id).first()
        if not food:
            continue

        ratio = quantity_g / 100.0

        proteins = _safe_decimal_to_float(food.proteins_g) * ratio
        fats = _safe_decimal_to_float(food.fats_g) * ratio
        carbs = _safe_decimal_to_float(food.carbs_g) * ratio

        totals["proteins_g"] += proteins
        totals["fats_g"] += fats
        totals["carbs_g"] += carbs
        # Calculate calories from macros: protein=4 cal/g, carbs=4 cal/g, fats=9 cal/g
        totals["calories"] += (proteins * 4) + (carbs * 4) + (fats * 9)

    return {key: round(value, 2) for key, value in totals.items()}


def validate_ingredients(
    ingredients: List[Dict],
    db: Session
) -> tuple[bool, List[str]]:
    """
    Validate that all ingredient food IDs exist in the database.

    This function checks that each food_id references a valid food
    in the foods table. Use this before creating/updating recipes
    to ensure all ingredients are valid.

    Args:
        ingredients: List of ingredient dictionaries with food_id
        db: Database session

    Returns:
        Tuple of (is_valid, error_messages):
            - is_valid (bool): True if all ingredients valid, False otherwise
            - error_messages (list): List of error messages for invalid ingredients

    Example:
        is_valid, errors = validate_ingredients(ingredients, db)
        if not is_valid:
            raise ValueError(f"Invalid ingredients: {', '.join(errors)}")
    """
    errors = []

    if not ingredients:
        return False, ["No ingredients provided"]

    for idx, ingredient in enumerate(ingredients):
        # Check food_id exists
        food_id = ingredient.get("food_id")
        if not food_id:
            errors.append(f"Ingredient {idx + 1}: missing food_id")
            continue

        # Check quantity is positive
        quantity_g = ingredient.get("quantity_g", 0)
        if not quantity_g or quantity_g <= 0:
            errors.append(f"Ingredient {idx + 1}: quantity must be positive")
            continue

        # Verify food exists in database
        food = db.query(Food).filter(Food.id == food_id).first()
        if not food:
            errors.append(f"Ingredient {idx + 1}: food_id {food_id} not found in database")

    is_valid = len(errors) == 0
    return is_valid, errors


def get_ingredient_nutrition_breakdown(
    ingredients: List[Dict],
    db: Session
) -> List[Dict]:
    """
    Calculate nutrition for each ingredient individually.

    This function returns the nutritional breakdown per ingredient,
    which is useful for detailed recipe views where you want to show
    the contribution of each ingredient.

    Args:
        ingredients: List of ingredient dictionaries
        db: Database session

    Returns:
        List of dictionaries, each containing:
            - food_id: UUID of food
            - food_name: Name of food (if available)
            - quantity_g: Quantity used
            - calories: Calories for this ingredient
            - proteins_g: Protein for this ingredient
            - fats_g: Fat for this ingredient
            - carbs_g: Carbs for this ingredient

    Example:
        breakdown = get_ingredient_nutrition_breakdown(ingredients, db)
        # [
        #     {
        #         "food_id": "uuid",
        #         "food_name": "Chicken",
        #         "quantity_g": 150,
        #         "calories": 165,
        #         "proteins_g": 34.5,
        #         "fats_g": 1.8,
        #         "carbs_g": 0
        #     },
        #     ...
        # ]
    """
    breakdown = []

    for ingredient in ingredients:
        food_id = ingredient.get("food_id")
        food_name = ingredient.get("food_name", "Unknown")
        quantity_g = float(ingredient.get("quantity_g", 0))

        if not food_id or quantity_g <= 0:
            continue

        food = db.query(Food).filter(Food.id == food_id).first()
        if not food:
            continue

        ratio = quantity_g / 100.0

        proteins = _safe_decimal_to_float(food.proteins_g) * ratio
        fats = _safe_decimal_to_float(food.fats_g) * ratio
        carbs = _safe_decimal_to_float(food.carbs_g) * ratio
        calories = (proteins * 4) + (carbs * 4) + (fats * 9)

        breakdown.append({
            "food_id": str(food_id),
            "food_name": food_name if food_name != "Unknown" else food.name,
            "quantity_g": quantity_g,
            "calories": round(calories, 2),
            "proteins_g": round(proteins, 2),
            "fats_g": round(fats, 2),
            "carbs_g": round(carbs, 2),
        })

    return breakdown


# Helper Functions
# ----------------

def _safe_decimal_to_float(value: Optional[Decimal]) -> float:
    """
    Safely convert a Decimal (or None) to float.

    SQLAlchemy Numeric columns return Decimal objects.
    This helper converts them to floats for calculations,
    treating None as 0.0.

    Args:
        value: Decimal value or None

    Returns:
        Float value (0.0 if None)
    """
    if value is None:
        return 0.0
    return float(value)


def calculate_nutrition_from_percentages(
    composition: List[Dict],
    db: Session
) -> Dict[str, float]:
    """
    Calculate nutritional values from a percentage-based composition.

    Each item represents a percentage of the final product (per 100g).
    For example: 80% Pork + 20% Garlic means 80g pork + 20g garlic per 100g product.

    Args:
        composition: List of dicts with food_id and percentage
        db: Database session

    Returns:
        Dictionary with calculated nutritional values per 100g of product
    """
    totals = {
        "proteins_g": 0.0,
        "fats_g": 0.0,
        "carbs_g": 0.0,
        "fibers_g": 0.0,
        "omega3_ala_g": 0.0,
        "omega6_g": 0.0,
        "calcium_g": 0.0,
        "iron_g": 0.0,
        "magnesium_g": 0.0,
        "potassium_g": 0.0,
        "zinc_g": 0.0,
        "vitamin_a_g": 0.0,
        "vitamin_c_g": 0.0,
        "vitamin_d_g": 0.0,
        "vitamin_e_g": 0.0,
        "vitamin_k_g": 0.0,
        "vitamin_b6_g": 0.0,
        "folate_b9_g": 0.0,
        "vitamin_b12_g": 0.0,
    }

    for item in composition:
        food_id = item.get("food_id")
        percentage = float(item.get("percentage", 0))

        if not food_id or percentage <= 0:
            continue

        food = db.query(Food).filter(Food.id == food_id).first()
        if not food:
            continue

        # percentage / 100 gives the ratio (e.g. 80% -> 0.8)
        # Food values are already per 100g, so ratio directly applies
        ratio = percentage / 100.0

        totals["proteins_g"] += _safe_decimal_to_float(food.proteins_g) * ratio
        totals["fats_g"] += _safe_decimal_to_float(food.fats_g) * ratio
        totals["carbs_g"] += _safe_decimal_to_float(food.carbs_g) * ratio
        totals["fibers_g"] += _safe_decimal_to_float(food.fibers_g) * ratio
        totals["omega3_ala_g"] += _safe_decimal_to_float(food.omega3_ala_g) * ratio
        totals["omega6_g"] += _safe_decimal_to_float(food.omega6_g) * ratio
        totals["calcium_g"] += _safe_decimal_to_float(food.calcium_g) * ratio
        totals["iron_g"] += _safe_decimal_to_float(food.iron_g) * ratio
        totals["magnesium_g"] += _safe_decimal_to_float(food.magnesium_g) * ratio
        totals["potassium_g"] += _safe_decimal_to_float(food.potassium_g) * ratio
        totals["zinc_g"] += _safe_decimal_to_float(food.zinc_g) * ratio
        totals["vitamin_a_g"] += _safe_decimal_to_float(food.vitamin_a_g) * ratio
        totals["vitamin_c_g"] += _safe_decimal_to_float(food.vitamin_c_g) * ratio
        totals["vitamin_d_g"] += _safe_decimal_to_float(food.vitamin_d_g) * ratio
        totals["vitamin_e_g"] += _safe_decimal_to_float(food.vitamin_e_g) * ratio
        totals["vitamin_k_g"] += _safe_decimal_to_float(food.vitamin_k_g) * ratio
        totals["vitamin_b6_g"] += _safe_decimal_to_float(food.vitamin_b6_g) * ratio
        totals["folate_b9_g"] += _safe_decimal_to_float(food.folate_b9_g) * ratio
        totals["vitamin_b12_g"] += _safe_decimal_to_float(food.vitamin_b12_g) * ratio

    return {key: round(value, 6) for key, value in totals.items()}


# Future Enhancement Ideas
# ------------------------
# 1. Add caching for frequently used foods
# 2. Support for recipe serving sizes (divide by servings)
# 3. Calculate % of daily recommended values
# 4. Support for custom nutrients (user-defined tracking)
# 5. Nutrition comparison between recipes
# 6. Allergen detection based on ingredients
