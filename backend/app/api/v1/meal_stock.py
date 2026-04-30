"""
Meal Stock Consumption
Decrementa la dispensa dei prodotti usati in una ricetta quando si registra un pasto.

Endpoints:
    GET  /meals/{meal_id}/recipe-stock-preview   - Anteprima senza consumare
    POST /meals/{meal_id}/consume-recipe-stock   - Consuma effettivamente la dispensa
"""

import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.dispensa import DispensaItem
from app.models.meal import Meal
from app.models.recipe import Recipe

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Meal Stock"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class StockConsumeRequest(BaseModel):
    house_id: UUID
    portion_multiplier: float = 1.0


class StockConsumePreview(BaseModel):
    product_id: str
    product_name: str
    quantity: float
    unit: str
    available_in_pantry: float
    will_be_available: float
    warning: Optional[str] = None


class StockConsumeResponse(BaseModel):
    consumed: List[StockConsumePreview]
    warnings: List[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _calculate_stock(
    meal_id: UUID,
    house_id: UUID,
    portion_multiplier: float,
    db: Session,
    dry_run: bool = False,
) -> StockConsumeResponse:
    """
    Core logic: finds recipe ingredients with product_id, matches them
    against active dispensa items, and optionally decrements quantities.
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pasto non trovato",
        )
    if not meal.recipe_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questo pasto non è associato a una ricetta",
        )

    recipe = db.query(Recipe).filter(Recipe.id == meal.recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ricetta non trovata",
        )

    # Only process ingredients that have a product_id (barcode-linked)
    product_ingredients = [
        ing for ing in (recipe.ingredients or [])
        if ing.get("product_id")
    ]

    consumed: List[StockConsumePreview] = []
    warnings: List[str] = []

    for ing in product_ingredients:
        product_id = ing["product_id"]
        quantity_needed = float(
            ing.get("quantity_g", ing.get("quantity", 0))
        ) * portion_multiplier
        unit = ing.get("unit", "g")
        product_name = ing.get("product_name") or ing.get("food_name", "Prodotto")

        # Find matching dispensa items ordered by expiry (FEFO)
        dispensa_items = (
            db.query(DispensaItem)
            .filter(
                DispensaItem.house_id == house_id,
                DispensaItem.product_catalog_id == product_id,
                DispensaItem.is_consumed == False,  # noqa: E712
            )
            .order_by(DispensaItem.expiry_date.asc().nulls_last())
            .all()
        )

        total_available = sum(float(i.quantity) for i in dispensa_items)
        will_be_available = max(0.0, total_available - quantity_needed)

        preview = StockConsumePreview(
            product_id=str(product_id),
            product_name=product_name,
            quantity=quantity_needed,
            unit=unit,
            available_in_pantry=total_available,
            will_be_available=will_be_available,
        )

        if total_available < quantity_needed:
            msg = (
                f"{product_name}: disponibile {total_available} {unit}, "
                f"richiesto {quantity_needed} {unit}"
            )
            preview.warning = f"Disponibile solo {total_available} {unit}"
            warnings.append(msg)

        if not dry_run:
            remaining = quantity_needed
            for item in dispensa_items:
                if remaining <= 0:
                    break
                item_qty = float(item.quantity)
                if remaining >= item_qty:
                    item.is_consumed = True
                    item.quantity = 0
                    remaining -= item_qty
                else:
                    item.quantity = item_qty - remaining
                    remaining = 0
            db.commit()

        consumed.append(preview)

    return StockConsumeResponse(consumed=consumed, warnings=warnings)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/meals/{meal_id}/recipe-stock-preview", response_model=StockConsumeResponse)
def preview_recipe_stock(
    meal_id: UUID,
    house_id: UUID,
    portion_multiplier: float = 1.0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Anteprima di quali prodotti verranno decrementati dalla dispensa
    quando si registra questo pasto. Non modifica nulla.
    """
    return _calculate_stock(meal_id, house_id, portion_multiplier, db, dry_run=True)


@router.post("/meals/{meal_id}/consume-recipe-stock", response_model=StockConsumeResponse)
def consume_recipe_stock(
    meal_id: UUID,
    body: StockConsumeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Decrementa la dispensa dei prodotti della ricetta associata a questo pasto.
    Usa FEFO (First Expired, First Out) per l'ordine di consumo.
    """
    return _calculate_stock(
        meal_id,
        body.house_id,
        body.portion_multiplier,
        db,
        dry_run=False,
    )
