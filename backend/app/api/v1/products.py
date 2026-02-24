"""
Products API Endpoints

Endpoints for product lookup using Open Food Facts database.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.product_catalog import ProductCatalog
from app.models.product_barcode import ProductBarcode
from app.services.barcode_source_service import lookup_barcode_chain


def _get_product_by_barcode(db: Session, barcode: str) -> Optional[ProductCatalog]:
    """Lookup ProductCatalog via ProductBarcode table."""
    return db.query(ProductCatalog).join(
        ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
    ).filter(
        ProductBarcode.barcode == barcode,
        ProductCatalog.cancelled == False
    ).first()


router = APIRouter(prefix="/products", tags=["Products"])


class ProductLookupResponse(BaseModel):
    """Response for barcode lookup."""
    found: bool
    barcode: str
    product_name: Optional[str] = None
    brand: Optional[str] = None
    image_url: Optional[str] = None
    quantity: Optional[str] = None
    categories: Optional[str] = None
    nutriscore: Optional[str] = None
    category_id: Optional[str] = None  # Local category from ProductCatalog
    nutrients: Optional[dict] = None  # { "energy-kcal_100g": ..., "proteins_100g": ..., ... }
    source_code: Optional[str] = None
    source_name: Optional[str] = None
    error: Optional[str] = None


@router.get(
    "/lookup/{barcode}",
    response_model=ProductLookupResponse,
    summary="Lookup Product by Barcode",
    description="""
    Look up a product by barcode using configurable barcode sources (fallback chain).
    Also checks the local product catalog for saved category.

    Sources are tried in order of priority until a result is found.
    """
)
async def lookup_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Look up a barcode using the fallback chain and local catalog."""
    result = await lookup_barcode_chain(db, barcode)

    # Check local catalog for saved category_id
    local_category_id = None
    local_product = _get_product_by_barcode(db, barcode)
    if local_product and local_product.category_id:
        local_category_id = str(local_product.category_id)

    # If not found in any source but exists locally with a name, return local data
    if not result["found"] and local_product and local_product.name:
        return ProductLookupResponse(
            found=True,
            barcode=barcode,
            product_name=local_product.name,
            brand=local_product.brand,
            quantity=local_product.quantity_text,
            categories=local_product.categories,
            nutriscore=local_product.nutriscore,
            category_id=local_category_id,
            source_code="local",
            source_name="Catalogo Locale",
        )

    return ProductLookupResponse(
        found=result["found"],
        barcode=result["barcode"],
        product_name=result.get("product_name"),
        brand=result.get("brand"),
        image_url=result.get("image_url"),
        quantity=result.get("quantity"),
        categories=result.get("categories"),
        nutriscore=result.get("nutriscore"),
        nutrients=result.get("nutrients"),
        category_id=local_category_id,
        source_code=result.get("source_code"),
        source_name=result.get("source_name"),
        error=result.get("error")
    )
