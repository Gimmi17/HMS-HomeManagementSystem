"""
Product Nutrition Service

Service for managing product nutritional data.
Handles fetching from APIs and saving to ProductNutrition table.
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.product_catalog import ProductCatalog
from app.models.product_nutrition import ProductNutrition
from app.integrations.openfoodfacts import openfoodfacts_client

logger = logging.getLogger(__name__)


class ProductNutritionService:
    """Service for product nutrition operations."""

    @staticmethod
    async def fetch_and_save_nutrition(
        db: Session,
        product_id: UUID,
        barcode: str
    ) -> Optional[ProductNutrition]:
        """
        Fetch nutritional data from Open Food Facts and save to ProductNutrition.

        Args:
            db: Database session
            product_id: ID of the ProductCatalog entry
            barcode: Product barcode for API lookup

        Returns:
            ProductNutrition entry or None if not found
        """
        # Check if nutrition already exists for this product
        existing = db.query(ProductNutrition).filter(
            ProductNutrition.product_id == product_id
        ).first()

        if existing:
            logger.info(f"[ProductNutrition] Already exists for product {product_id}")
            return existing

        # Fetch full data from Open Food Facts
        logger.info(f"[ProductNutrition] Fetching data for barcode {barcode}...")
        api_data = await openfoodfacts_client.lookup_barcode_full(barcode)

        if not api_data.get("found"):
            logger.info(f"[ProductNutrition] No data found for barcode {barcode}")
            return None

        # Create ProductNutrition entry
        nutrition = ProductNutritionService._create_from_api_data(
            product_id=product_id,
            api_data=api_data
        )

        db.add(nutrition)
        db.commit()
        db.refresh(nutrition)

        logger.info(f"[ProductNutrition] Saved nutrition data for {api_data.get('product_name')}")
        return nutrition

    @staticmethod
    def _create_from_api_data(product_id: UUID, api_data: Dict[str, Any]) -> ProductNutrition:
        """Create ProductNutrition from API response data."""
        return ProductNutrition(
            product_id=product_id,

            # Product info
            product_name=api_data.get("product_name"),
            brands=api_data.get("brands"),
            quantity=api_data.get("quantity"),
            serving_size=api_data.get("serving_size"),
            categories=api_data.get("categories"),
            ingredients_text=api_data.get("ingredients_text"),
            allergens=api_data.get("allergens"),
            traces=api_data.get("traces"),
            labels=api_data.get("labels"),
            origins=api_data.get("origins"),
            packaging=api_data.get("packaging"),

            # Scores
            nutriscore_grade=api_data.get("nutriscore_grade"),
            ecoscore_grade=api_data.get("ecoscore_grade"),
            nova_group=api_data.get("nova_group"),
            nutrition_score_fr=api_data.get("nutrition_score_fr"),

            # Basic nutrients
            energy_kcal=api_data.get("energy_kcal"),
            energy_kj=api_data.get("energy_kj"),
            fat=api_data.get("fat"),
            saturated_fat=api_data.get("saturated_fat"),
            carbohydrates=api_data.get("carbohydrates"),
            sugars=api_data.get("sugars"),
            added_sugars=api_data.get("added_sugars"),
            starch=api_data.get("starch"),
            fiber=api_data.get("fiber"),
            proteins=api_data.get("proteins"),
            salt=api_data.get("salt"),
            sodium=api_data.get("sodium"),

            # Minerals
            calcium=api_data.get("calcium"),
            iron=api_data.get("iron"),
            magnesium=api_data.get("magnesium"),
            manganese=api_data.get("manganese"),
            phosphorus=api_data.get("phosphorus"),
            potassium=api_data.get("potassium"),
            copper=api_data.get("copper"),
            selenium=api_data.get("selenium"),
            zinc=api_data.get("zinc"),

            # Vitamins
            vitamin_a=api_data.get("vitamin_a"),
            vitamin_b1=api_data.get("vitamin_b1"),
            vitamin_b2=api_data.get("vitamin_b2"),
            vitamin_b6=api_data.get("vitamin_b6"),
            vitamin_b9=api_data.get("vitamin_b9"),
            vitamin_b12=api_data.get("vitamin_b12"),
            vitamin_c=api_data.get("vitamin_c"),
            vitamin_d=api_data.get("vitamin_d"),
            vitamin_e=api_data.get("vitamin_e"),
            vitamin_k=api_data.get("vitamin_k"),

            # Other
            caffeine=api_data.get("caffeine"),
            choline=api_data.get("choline"),
            fruits_vegetables_nuts=api_data.get("fruits_vegetables_nuts"),

            # Raw data
            raw_nutriments=api_data.get("raw_nutriments"),
            raw_api_response=api_data.get("raw_response"),

            # Metadata
            source="openfoodfacts",
            fetched_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def create_manual(
        db: Session,
        product_id: UUID,
        data: Dict[str, Any]
    ) -> ProductNutrition:
        """
        Create ProductNutrition entry with manually entered data.

        Args:
            db: Database session
            product_id: ID of the ProductCatalog entry
            data: Dictionary with nutrition data

        Returns:
            ProductNutrition entry
        """
        # Check if nutrition already exists
        existing = db.query(ProductNutrition).filter(
            ProductNutrition.product_id == product_id
        ).first()

        if existing:
            # Update existing
            for key, value in data.items():
                if hasattr(existing, key) and value is not None:
                    setattr(existing, key, value)
            existing.source = "manual"
            db.commit()
            db.refresh(existing)
            return existing

        # Create new
        nutrition = ProductNutrition(
            product_id=product_id,
            source="manual",
            fetched_at=datetime.now(timezone.utc),
            **{k: v for k, v in data.items() if hasattr(ProductNutrition, k)}
        )

        db.add(nutrition)
        db.commit()
        db.refresh(nutrition)

        return nutrition

    @staticmethod
    def get_by_product_id(db: Session, product_id: UUID) -> Optional[ProductNutrition]:
        """Get ProductNutrition by product_id."""
        return db.query(ProductNutrition).filter(
            ProductNutrition.product_id == product_id
        ).first()

    @staticmethod
    def get_by_barcode(db: Session, barcode: str, house_id: Optional[UUID] = None) -> Optional[ProductNutrition]:
        """Get ProductNutrition by barcode (through ProductCatalog)."""
        query = db.query(ProductNutrition).join(ProductCatalog).filter(
            ProductCatalog.barcode == barcode
        )
        if house_id:
            query = query.filter(ProductCatalog.house_id == house_id)

        return query.first()

    @staticmethod
    def update(
        db: Session,
        nutrition_id: UUID,
        data: Dict[str, Any]
    ) -> Optional[ProductNutrition]:
        """Update ProductNutrition entry."""
        nutrition = db.query(ProductNutrition).filter(
            ProductNutrition.id == nutrition_id
        ).first()

        if not nutrition:
            return None

        for key, value in data.items():
            if hasattr(nutrition, key):
                setattr(nutrition, key, value)

        db.commit()
        db.refresh(nutrition)

        return nutrition

    @staticmethod
    def delete(db: Session, nutrition_id: UUID) -> bool:
        """Delete ProductNutrition entry."""
        nutrition = db.query(ProductNutrition).filter(
            ProductNutrition.id == nutrition_id
        ).first()

        if not nutrition:
            return False

        db.delete(nutrition)
        db.commit()

        return True


# Singleton instance
product_nutrition_service = ProductNutritionService()
