"""
Meal Planner Service
Business logic for the meal planning wizard.

Provides:
- Pantry availability analysis with expiry tracking
- Recipe scoring based on ingredient availability and expiry urgency
- LLM prompt building for meal suggestions
- Meal plan confirmation (creates Meal records)
"""

import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.dispensa import DispensaItem
from app.models.recipe import Recipe
from app.schemas.meal import MealCreate
from app.services.meal_service import create_meal

logger = logging.getLogger(__name__)


# =============================================================================
# Pydantic Schemas
# =============================================================================

class MealConfig(BaseModel):
    meal_type: str
    user_ids: list[UUID]


class DayPlan(BaseModel):
    date: date
    meals: list[MealConfig]


class GenerateRequest(BaseModel):
    house_id: UUID
    plan: list[DayPlan]


class SuggestionItem(BaseModel):
    recipe_id: UUID
    recipe_name: str
    reason: str = ""
    avg_expiry_days: Optional[float] = None
    expiry_alert: bool = False
    coverage_ratio: float = 0.0
    calories: Optional[float] = None
    proteins_g: Optional[float] = None
    fats_g: Optional[float] = None
    carbs_g: Optional[float] = None


class MealSuggestions(BaseModel):
    date: date
    meal_type: str
    user_ids: list[UUID]
    suggestions: list[SuggestionItem]


class GenerateResponse(BaseModel):
    meals: list[MealSuggestions]
    pantry_summary: dict


class MealSelection(BaseModel):
    date: date
    meal_type: str
    recipe_id: UUID
    user_ids: list[UUID]


class ConfirmRequest(BaseModel):
    house_id: UUID
    selections: list[MealSelection]


# =============================================================================
# Internal data structures
# =============================================================================

class PantryItem:
    def __init__(self, name: str, total_qty: float, unit: Optional[str], min_expiry_date: Optional[date]):
        self.name = name
        self.total_qty = total_qty
        self.unit = unit
        self.min_expiry_date = min_expiry_date


class ScoredRecipe:
    def __init__(self, recipe: Recipe, coverage_ratio: float, avg_expiry_days: Optional[float], expiry_score: int):
        self.recipe = recipe
        self.coverage_ratio = coverage_ratio
        self.avg_expiry_days = avg_expiry_days
        self.expiry_score = expiry_score


# =============================================================================
# Core Functions
# =============================================================================

def get_pantry_availability(db: Session, house_id: UUID) -> dict[str, PantryItem]:
    """
    Query unconsumed pantry items grouped by name.
    Returns dict keyed by lowercase name with aggregated info.
    """
    items = db.query(DispensaItem).filter(
        DispensaItem.house_id == house_id,
        DispensaItem.is_consumed == False,
    ).all()

    pantry: dict[str, PantryItem] = {}
    for item in items:
        key = item.name.strip().lower()
        if key in pantry:
            pantry[key].total_qty += float(item.quantity or 0)
            if item.expiry_date and (pantry[key].min_expiry_date is None or item.expiry_date < pantry[key].min_expiry_date):
                pantry[key].min_expiry_date = item.expiry_date
        else:
            pantry[key] = PantryItem(
                name=item.name.strip(),
                total_qty=float(item.quantity or 0),
                unit=item.unit,
                min_expiry_date=item.expiry_date,
            )

    return pantry


def score_recipes(db: Session, house_id: UUID, pantry: dict[str, PantryItem]) -> list[ScoredRecipe]:
    """
    Score all house recipes by pantry ingredient match and expiry urgency.
    """
    recipes = db.query(Recipe).filter(Recipe.house_id == house_id).all()
    today = date.today()
    scored: list[ScoredRecipe] = []

    for recipe in recipes:
        ingredients = recipe.ingredients or []
        if not ingredients:
            scored.append(ScoredRecipe(recipe=recipe, coverage_ratio=0.0, avg_expiry_days=None, expiry_score=0))
            continue

        total_ingredients = len(ingredients)
        found_count = 0
        expiry_days_list: list[float] = []
        expiry_score = 0

        for ing in ingredients:
            food_name = (ing.get("food_name") or "").strip().lower()
            if not food_name:
                continue

            # Try exact match first, then substring match
            matched_item = pantry.get(food_name)
            if not matched_item:
                for pkey, pitem in pantry.items():
                    if food_name in pkey or pkey in food_name:
                        matched_item = pitem
                        break

            if matched_item:
                found_count += 1
                if matched_item.min_expiry_date:
                    days_to_expiry = (matched_item.min_expiry_date - today).days
                    expiry_days_list.append(days_to_expiry)
                    if days_to_expiry <= 3:
                        expiry_score += 1

        coverage_ratio = found_count / total_ingredients if total_ingredients > 0 else 0.0
        avg_expiry_days = sum(expiry_days_list) / len(expiry_days_list) if expiry_days_list else None

        scored.append(ScoredRecipe(
            recipe=recipe,
            coverage_ratio=coverage_ratio,
            avg_expiry_days=avg_expiry_days,
            expiry_score=expiry_score,
        ))

    # Sort: expiry_score DESC, then avg_expiry_days ASC (None last)
    scored.sort(key=lambda s: (
        -s.expiry_score,
        s.avg_expiry_days if s.avg_expiry_days is not None else 9999,
    ))

    return scored


def build_llm_prompt(
    scored_recipes: list[ScoredRecipe],
    pantry: dict[str, PantryItem],
    meal_type: str,
    people_count: int,
    target_date: date,
) -> list[dict]:
    """
    Build chat messages for the LLM to generate meal suggestions.
    """
    today = date.today()

    # Build pantry summary string
    pantry_lines = []
    for key, item in sorted(pantry.items(), key=lambda x: (x[1].min_expiry_date or date(2099, 1, 1))):
        exp_str = ""
        if item.min_expiry_date:
            days = (item.min_expiry_date - today).days
            exp_str = f" (scade tra {days}gg)" if days >= 0 else f" (SCADUTO {abs(days)}gg fa)"
        pantry_lines.append(f"- {item.name}: {item.total_qty} {item.unit or 'pz'}{exp_str}")

    pantry_text = "\n".join(pantry_lines) if pantry_lines else "Dispensa vuota."

    # Build recipes summary string (top 20)
    recipe_lines = []
    for sr in scored_recipes[:20]:
        r = sr.recipe
        exp_info = ""
        if sr.expiry_score > 0:
            exp_info = f" [!SCADENZA: {sr.expiry_score} ingredienti in scadenza]"
        avg_info = ""
        if sr.avg_expiry_days is not None:
            avg_info = f" [media scadenza: {sr.avg_expiry_days:.0f}gg]"
        coverage_info = f" [copertura: {sr.coverage_ratio:.0%}]"

        recipe_lines.append(f"- id:{r.id} | {r.name}{coverage_info}{exp_info}{avg_info}")

    recipes_text = "\n".join(recipe_lines) if recipe_lines else "Nessuna ricetta disponibile."

    system_msg = {
        "role": "system",
        "content": (
            "Sei un chef che suggerisce piatti per un menu domestico. "
            "Rispondi SOLO con un array JSON valido, senza testo aggiuntivo. "
            "Prioritizza ricette che usano ingredienti in scadenza."
        ),
    }

    user_msg = {
        "role": "user",
        "content": (
            f"Data: {target_date.isoformat()}\n"
            f"Pasto: {meal_type}\n"
            f"Persone: {people_count}\n\n"
            f"PRODOTTI IN DISPENSA:\n{pantry_text}\n\n"
            f"RICETTE DISPONIBILI:\n{recipes_text}\n\n"
            "Seleziona max 10 piatti ordinati per urgenza scadenza ingredienti. "
            "Formato risposta (JSON array):\n"
            '[{"recipe_id": "uuid", "recipe_name": "nome", "reason": "motivo breve", '
            '"expiry_alert": true/false, "avg_expiry_days": numero_o_null}]'
        ),
    }

    return [system_msg, user_msg]


def _parse_llm_response(response_text: str) -> list[dict]:
    """Parse JSON array from LLM response, handling markdown fences."""
    text = response_text.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last fence lines
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        # Try to find JSON array in the text
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    logger.warning("Failed to parse LLM response as JSON array")
    return []


def _scored_to_suggestions(scored_recipes: list[ScoredRecipe], limit: int = 10) -> list[SuggestionItem]:
    """Convert scored recipes to suggestion items (fallback without LLM)."""
    suggestions = []
    for sr in scored_recipes[:limit]:
        r = sr.recipe
        reason = ""
        if sr.expiry_score > 0:
            reason = f"{sr.expiry_score} ingredienti in scadenza"
        elif sr.coverage_ratio > 0:
            reason = f"{sr.coverage_ratio:.0%} ingredienti disponibili"

        suggestions.append(SuggestionItem(
            recipe_id=r.id,
            recipe_name=r.name,
            reason=reason,
            avg_expiry_days=sr.avg_expiry_days,
            expiry_alert=sr.expiry_score > 0,
            coverage_ratio=sr.coverage_ratio,
            calories=float(r.total_calories) if r.total_calories else None,
            proteins_g=float(r.total_proteins_g) if r.total_proteins_g else None,
            fats_g=float(r.total_fats_g) if r.total_fats_g else None,
            carbs_g=float(r.total_carbs_g) if r.total_carbs_g else None,
        ))
    return suggestions


async def generate_suggestions(
    db: Session,
    house_id: UUID,
    request: GenerateRequest,
    llm_client=None,
) -> GenerateResponse:
    """
    Generate meal suggestions for each day/meal combination.
    Uses LLM if available, falls back to score-based ordering.
    """
    pantry = get_pantry_availability(db, house_id)
    scored = score_recipes(db, house_id, pantry)

    # Build pantry summary for UI
    pantry_summary = {}
    today = date.today()
    expiring_soon = 0
    total_items = 0
    for key, item in pantry.items():
        total_items += 1
        if item.min_expiry_date and (item.min_expiry_date - today).days <= 3:
            expiring_soon += 1
    pantry_summary = {
        "total_items": total_items,
        "expiring_soon": expiring_soon,
    }

    meals_suggestions: list[MealSuggestions] = []

    for day_plan in request.plan:
        for meal_config in day_plan.meals:
            people_count = len(meal_config.user_ids)

            suggestions: list[SuggestionItem] = []

            # Try LLM first
            if llm_client and scored:
                try:
                    messages = build_llm_prompt(scored, pantry, meal_config.meal_type, people_count, day_plan.date)
                    response_text = await llm_client.chat_completion(messages, max_tokens=2000)

                    if response_text:
                        parsed = _parse_llm_response(response_text)
                        # Map LLM response to SuggestionItems
                        recipe_map = {str(sr.recipe.id): sr for sr in scored}
                        for item in parsed[:10]:
                            rid = item.get("recipe_id", "")
                            sr = recipe_map.get(rid)
                            if sr:
                                suggestions.append(SuggestionItem(
                                    recipe_id=sr.recipe.id,
                                    recipe_name=item.get("recipe_name", sr.recipe.name),
                                    reason=item.get("reason", ""),
                                    avg_expiry_days=item.get("avg_expiry_days", sr.avg_expiry_days),
                                    expiry_alert=item.get("expiry_alert", sr.expiry_score > 0),
                                    coverage_ratio=sr.coverage_ratio,
                                    calories=float(sr.recipe.total_calories) if sr.recipe.total_calories else None,
                                    proteins_g=float(sr.recipe.total_proteins_g) if sr.recipe.total_proteins_g else None,
                                    fats_g=float(sr.recipe.total_fats_g) if sr.recipe.total_fats_g else None,
                                    carbs_g=float(sr.recipe.total_carbs_g) if sr.recipe.total_carbs_g else None,
                                ))
                except Exception as e:
                    logger.warning(f"LLM suggestion generation failed: {e}")

            # Fallback: use scored recipes directly
            if not suggestions:
                suggestions = _scored_to_suggestions(scored)

            meals_suggestions.append(MealSuggestions(
                date=day_plan.date,
                meal_type=meal_config.meal_type,
                user_ids=meal_config.user_ids,
                suggestions=suggestions,
            ))

    return GenerateResponse(meals=meals_suggestions, pantry_summary=pantry_summary)


def confirm_selections(
    db: Session,
    house_id: UUID,
    user_id: UUID,
    selections: list[MealSelection],
) -> list:
    """
    Create Meal records for each selection/person combination.
    """
    # Map meal_type to a default time
    meal_times = {
        "colazione": (8, 0),
        "spuntino": (10, 30),
        "pranzo": (13, 0),
        "cena": (20, 0),
    }

    created_meals = []

    for sel in selections:
        hour, minute = meal_times.get(sel.meal_type, (12, 0))
        consumed_at = datetime.combine(sel.date, datetime.min.time().replace(hour=hour, minute=minute))

        for uid in sel.user_ids:
            meal_data = MealCreate(
                recipe_id=sel.recipe_id,
                meal_type=sel.meal_type,
                consumed_at=consumed_at,
            )
            try:
                meal = create_meal(db, uid, house_id, meal_data)
                created_meals.append(meal)
            except Exception as e:
                logger.error(f"Failed to create meal for user {uid}: {e}")

    return created_meals
