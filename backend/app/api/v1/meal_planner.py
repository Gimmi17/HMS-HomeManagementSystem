"""
Meal Planner API Endpoints

Provides endpoints for the meal planning wizard:
- POST /meal-planner/generate  - Generate meal suggestions using LLM + pantry scoring
- POST /meal-planner/confirm   - Confirm selections and create Meal records
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.house import House
from app.models.user_house import UserHouse
from app.integrations.llm import LLMConnection, LLMPurpose, get_llm_manager
from app.services.meal_planner_service import (
    GenerateRequest,
    GenerateResponse,
    ConfirmRequest,
    generate_suggestions,
    confirm_selections,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meal-planner", tags=["Meal Planner"])


def _verify_house_membership(db: Session, user_id, house_id) -> House:
    """Verify user belongs to house and return the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non sei membro di questa casa",
        )

    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Casa non trovata",
        )
    return house


def _get_llm_client(house: House):
    """Try to get an LLM client configured for suggestions."""
    manager = get_llm_manager()

    # Load connections from house settings
    settings = house.settings or {}
    llm_configs = settings.get("llm_connections", [])
    for config in llm_configs:
        try:
            conn = LLMConnection.from_dict(config)
            manager.add_connection(conn)
        except Exception:
            pass

    return manager.get_client_for_purpose(LLMPurpose.SUGGESTIONS)


@router.post("/generate", response_model=GenerateResponse)
async def generate_meal_suggestions(
    data: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate meal suggestions for each day/meal combination.

    Uses LLM (if configured) to select the best recipes based on
    pantry availability and ingredient expiry dates.
    Falls back to score-based ordering if LLM is unavailable.
    """
    house = _verify_house_membership(db, current_user.id, data.house_id)

    llm_client = _get_llm_client(house)

    try:
        result = await generate_suggestions(db, data.house_id, data, llm_client=llm_client)
        return result
    except Exception as e:
        logger.error(f"Generate suggestions failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante la generazione dei suggerimenti: {str(e)}",
        )


@router.post("/confirm")
async def confirm_meal_plan(
    data: ConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm meal selections and create Meal records.

    Creates one Meal record per user_id per selection.
    """
    _verify_house_membership(db, current_user.id, data.house_id)

    try:
        created_meals = confirm_selections(db, data.house_id, current_user.id, data.selections)
        return {
            "created": len(created_meals),
            "meals": [
                {
                    "id": str(m.id),
                    "user_id": str(m.user_id),
                    "recipe_id": str(m.recipe_id) if m.recipe_id else None,
                    "meal_type": m.meal_type,
                    "consumed_at": m.consumed_at.isoformat() if m.consumed_at else None,
                }
                for m in created_meals
            ],
        }
    except Exception as e:
        logger.error(f"Confirm selections failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante la conferma del piano pasti: {str(e)}",
        )
