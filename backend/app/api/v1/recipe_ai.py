"""
Recipe AI Endpoint

Generates a recipe suggestion using an LLM, optionally leveraging
the house pantry (dispensa) as ingredient source.

Endpoint:
    POST /recipes/generate
"""

import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.api.v1.recipes import verify_house_membership
from app.db.session import get_db
from app.integrations.llm import LLMConnection, LLMPurpose, get_llm_manager
from app.models.dispensa import DispensaItem
from app.models.house import House
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["recipes-ai"])


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class RecipeGenerateRequest(BaseModel):
    house_id: UUID
    use_pantry: bool = True
    constraints: str = ""
    servings: int = 2


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_llm_client(house: House):
    """
    Load LLM connections from house settings and return the first client
    configured for CHAT (with GENERAL as fallback).
    """
    manager = get_llm_manager()

    settings = house.settings or {}
    llm_configs = settings.get("llm_connections", [])
    for config in llm_configs:
        try:
            conn = LLMConnection.from_dict(config)
            manager.add_connection(conn)
        except Exception as exc:
            logger.warning(f"Skipping invalid LLM config: {exc}")

    return manager.get_client_for_purpose(LLMPurpose.CHAT)


def _build_prompt(pantry_names: list[str], constraints: str, servings: int) -> str:
    """Build the user prompt for the recipe generation request."""
    lines = [
        f"Genera una ricetta per {servings} persone.",
    ]

    if pantry_names:
        ingredient_list = ", ".join(pantry_names)
        lines.append(
            f"Usa preferibilmente questi ingredienti disponibili in dispensa: {ingredient_list}."
        )
    else:
        lines.append("Non ci sono ingredienti in dispensa: proponi una ricetta qualsiasi.")

    if constraints and constraints.strip():
        lines.append(f"Vincoli / preferenze: {constraints.strip()}")

    lines.append("")
    lines.append(
        "Rispondi SOLO con un oggetto JSON valido (nessun testo prima o dopo) con questa struttura:"
    )
    lines.append(
        json.dumps(
            {
                "name": "Nome ricetta",
                "description": "Breve descrizione",
                "preparation_time_min": 30,
                "difficulty": "easy|medium|hard",
                "procedure": "Istruzioni passo per passo",
                "tags": ["tag1", "tag2"],
                "ingredients": [
                    {"food_name": "nome ingrediente", "quantity": 100, "unit": "g"}
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate_recipe(
    data: RecipeGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a recipe suggestion via LLM.

    - Verifies house membership.
    - Optionally queries the pantry for available ingredient names.
    - Builds a prompt and calls the configured CHAT LLM.
    - Returns the parsed recipe JSON.
    """
    # 1. Verify membership
    verify_house_membership(db, current_user.id, data.house_id)

    # 2. Fetch house (needed for LLM settings)
    house = db.query(House).filter(House.id == data.house_id).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Casa non trovata",
        )

    # 3. Pantry ingredients
    pantry_names: list[str] = []
    if data.use_pantry:
        items = (
            db.query(DispensaItem)
            .filter(
                DispensaItem.house_id == data.house_id,
                DispensaItem.is_consumed == False,  # noqa: E712
            )
            .all()
        )
        pantry_names = [item.name for item in items if item.name]

    # 4. Get LLM client
    client = _get_llm_client(house)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM non configurato. Vai in Impostazioni > LLM.",
        )

    # 5. Call LLM
    prompt = _build_prompt(pantry_names, data.constraints, data.servings)
    messages = [
        {
            "role": "system",
            "content": (
                "Sei un assistente culinario esperto. "
                "Rispondi sempre e solo con JSON valido, senza markdown, senza testo aggiuntivo."
            ),
        },
        {"role": "user", "content": prompt},
    ]

    raw_response = await client.chat_completion(messages=messages, max_tokens=1024)

    if not raw_response:
        logger.error("LLM returned empty response for recipe generation")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM non ha restituito una risposta. Riprova.",
        )

    # 6. Parse JSON
    # Strip optional markdown code fences that some models add
    cleaned = raw_response.strip()
    if cleaned.startswith("```"):
        # Remove ```json ... ``` or ``` ... ```
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

    try:
        recipe_data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.error(f"Failed to parse LLM recipe JSON: {exc}\nRaw: {raw_response[:500]}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Il modello LLM non ha restituito un JSON valido. Riprova.",
        )

    # 7. Return parsed dict
    return recipe_data
