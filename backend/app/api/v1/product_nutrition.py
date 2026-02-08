"""
Product Nutrition API Endpoints

Endpoints for managing detailed nutritional data from external APIs or manual entry.
ProductNutrition is linked to ProductCatalog entries.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.product_catalog import ProductCatalog
from app.models.product_nutrition import ProductNutrition
from app.models.user_house import UserHouse
from app.services.product_nutrition_service import product_nutrition_service


router = APIRouter(prefix="/product-nutrition")


def verify_house_access(db: Session, user_id: UUID, house_id: UUID) -> bool:
    """Verify user has access to the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()
    return membership is not None


# ============================================================
# RESPONSE SCHEMAS
# ============================================================

class ProductNutritionResponse(BaseModel):
    """Complete product nutrition response."""
    id: UUID
    product_id: UUID

    # Product info
    product_name: Optional[str] = None
    brands: Optional[str] = None
    quantity: Optional[str] = None
    serving_size: Optional[str] = None
    categories: Optional[str] = None
    ingredients_text: Optional[str] = None
    allergens: Optional[str] = None
    traces: Optional[str] = None
    labels: Optional[str] = None
    origins: Optional[str] = None
    packaging: Optional[str] = None

    # Scores
    nutriscore_grade: Optional[str] = None
    ecoscore_grade: Optional[str] = None
    nova_group: Optional[int] = None
    nutrition_score_fr: Optional[int] = None

    # Basic nutrients (per 100g)
    energy_kcal: Optional[float] = None
    energy_kj: Optional[float] = None
    fat: Optional[float] = None
    saturated_fat: Optional[float] = None
    carbohydrates: Optional[float] = None
    sugars: Optional[float] = None
    added_sugars: Optional[float] = None
    starch: Optional[float] = None
    fiber: Optional[float] = None
    proteins: Optional[float] = None
    salt: Optional[float] = None
    sodium: Optional[float] = None

    # Minerals
    calcium: Optional[float] = None
    iron: Optional[float] = None
    magnesium: Optional[float] = None
    manganese: Optional[float] = None
    phosphorus: Optional[float] = None
    potassium: Optional[float] = None
    copper: Optional[float] = None
    selenium: Optional[float] = None
    zinc: Optional[float] = None

    # Vitamins
    vitamin_a: Optional[float] = None
    vitamin_b1: Optional[float] = None
    vitamin_b2: Optional[float] = None
    vitamin_b6: Optional[float] = None
    vitamin_b9: Optional[float] = None
    vitamin_b12: Optional[float] = None
    vitamin_c: Optional[float] = None
    vitamin_d: Optional[float] = None
    vitamin_e: Optional[float] = None
    vitamin_k: Optional[float] = None

    # Other
    caffeine: Optional[float] = None
    choline: Optional[float] = None
    fruits_vegetables_nuts: Optional[float] = None

    # Metadata
    source: str = "openfoodfacts"
    fetched_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductNutritionSummary(BaseModel):
    """Summary response for list views."""
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    brands: Optional[str] = None
    nutriscore_grade: Optional[str] = None
    energy_kcal: Optional[float] = None
    proteins: Optional[float] = None
    carbohydrates: Optional[float] = None
    fat: Optional[float] = None
    source: str
    fetched_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# REQUEST SCHEMAS
# ============================================================

class ProductNutritionManualCreate(BaseModel):
    """Schema for manual nutrition data entry."""
    # Product info
    product_name: Optional[str] = None
    brands: Optional[str] = None
    quantity: Optional[str] = None
    serving_size: Optional[str] = None
    categories: Optional[str] = None
    ingredients_text: Optional[str] = None
    allergens: Optional[str] = None

    # Scores
    nutriscore_grade: Optional[str] = Field(None, pattern="^[a-eA-E]$")
    nova_group: Optional[int] = Field(None, ge=1, le=4)

    # Basic nutrients (per 100g)
    energy_kcal: Optional[float] = Field(None, ge=0)
    fat: Optional[float] = Field(None, ge=0)
    saturated_fat: Optional[float] = Field(None, ge=0)
    carbohydrates: Optional[float] = Field(None, ge=0)
    sugars: Optional[float] = Field(None, ge=0)
    fiber: Optional[float] = Field(None, ge=0)
    proteins: Optional[float] = Field(None, ge=0)
    salt: Optional[float] = Field(None, ge=0)
    sodium: Optional[float] = Field(None, ge=0)

    # Minerals
    calcium: Optional[float] = Field(None, ge=0)
    iron: Optional[float] = Field(None, ge=0)
    magnesium: Optional[float] = Field(None, ge=0)
    potassium: Optional[float] = Field(None, ge=0)
    zinc: Optional[float] = Field(None, ge=0)

    # Vitamins
    vitamin_a: Optional[float] = Field(None, ge=0)
    vitamin_c: Optional[float] = Field(None, ge=0)
    vitamin_d: Optional[float] = Field(None, ge=0)


class ProductNutritionUpdate(BaseModel):
    """Schema for updating nutrition data."""
    # Product info
    product_name: Optional[str] = None
    serving_size: Optional[str] = None
    ingredients_text: Optional[str] = None
    allergens: Optional[str] = None

    # Scores
    nutriscore_grade: Optional[str] = Field(None, pattern="^[a-eA-E]$")
    nova_group: Optional[int] = Field(None, ge=1, le=4)

    # Basic nutrients
    energy_kcal: Optional[float] = Field(None, ge=0)
    fat: Optional[float] = Field(None, ge=0)
    saturated_fat: Optional[float] = Field(None, ge=0)
    carbohydrates: Optional[float] = Field(None, ge=0)
    sugars: Optional[float] = Field(None, ge=0)
    fiber: Optional[float] = Field(None, ge=0)
    proteins: Optional[float] = Field(None, ge=0)
    salt: Optional[float] = Field(None, ge=0)


# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/product/{product_id}", response_model=ProductNutritionResponse)
def get_nutrition_by_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get nutritional data for a product.
    """
    # First verify the product exists and user has access
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato"
        )

    # Verify house access
    if product.house_id and not verify_house_access(db, current_user.id, product.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo prodotto"
        )

    nutrition = product_nutrition_service.get_by_product_id(db, product_id)
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non disponibili per questo prodotto"
        )

    return nutrition


@router.get("/barcode/{barcode}", response_model=ProductNutritionResponse)
def get_nutrition_by_barcode(
    barcode: str,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get nutritional data for a product by barcode.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    nutrition = product_nutrition_service.get_by_barcode(db, barcode, house_id)
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non disponibili per questo barcode"
        )

    return nutrition


@router.post("/product/{product_id}/fetch", response_model=ProductNutritionResponse)
async def fetch_nutrition_from_api(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch nutritional data from Open Food Facts API and save it.
    If data already exists, returns existing data.
    """
    # Verify product exists and get barcode
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato"
        )

    # Verify house access
    if product.house_id and not verify_house_access(db, current_user.id, product.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo prodotto"
        )

    if not product.barcode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prodotto senza barcode, impossibile cercare dati nutrizionali"
        )

    # Fetch and save
    nutrition = await product_nutrition_service.fetch_and_save_nutrition(
        db=db,
        product_id=product_id,
        barcode=product.barcode
    )

    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non trovati su Open Food Facts"
        )

    return nutrition


@router.post("/product/{product_id}", response_model=ProductNutritionResponse, status_code=status.HTTP_201_CREATED)
def create_manual_nutrition(
    product_id: UUID,
    data: ProductNutritionManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually create or update nutritional data for a product.
    If data already exists, it will be updated.
    """
    # Verify product exists
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato"
        )

    # Verify house access
    if product.house_id and not verify_house_access(db, current_user.id, product.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo prodotto"
        )

    # Create or update using service
    nutrition = product_nutrition_service.create_manual(
        db=db,
        product_id=product_id,
        data=data.model_dump(exclude_unset=True)
    )

    return nutrition


@router.put("/{nutrition_id}", response_model=ProductNutritionResponse)
def update_nutrition(
    nutrition_id: UUID,
    data: ProductNutritionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update existing nutritional data.
    """
    # Get nutrition and verify access through product
    nutrition = db.query(ProductNutrition).filter(ProductNutrition.id == nutrition_id).first()
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non trovati"
        )

    product = db.query(ProductCatalog).filter(ProductCatalog.id == nutrition.product_id).first()
    if product and product.house_id and not verify_house_access(db, current_user.id, product.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo prodotto"
        )

    # Update
    updated = product_nutrition_service.update(
        db=db,
        nutrition_id=nutrition_id,
        data=data.model_dump(exclude_unset=True)
    )

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non trovati"
        )

    return updated


@router.delete("/{nutrition_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nutrition(
    nutrition_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete nutritional data (allows re-fetch from API).
    """
    # Get nutrition and verify access through product
    nutrition = db.query(ProductNutrition).filter(ProductNutrition.id == nutrition_id).first()
    if not nutrition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non trovati"
        )

    product = db.query(ProductCatalog).filter(ProductCatalog.id == nutrition.product_id).first()
    if product and product.house_id and not verify_house_access(db, current_user.id, product.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo prodotto"
        )

    success = product_nutrition_service.delete(db, nutrition_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dati nutrizionali non trovati"
        )
