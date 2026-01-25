"""
Products API Endpoints

Endpoints for product lookup using Open Food Facts database.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

from app.api.v1.deps import get_current_user
from app.models.user import User
from app.integrations.openfoodfacts import openfoodfacts_client


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
    error: Optional[str] = None


@router.get(
    "/lookup/{barcode}",
    response_model=ProductLookupResponse,
    summary="Lookup Product by Barcode",
    description="""
    Look up a product by barcode using Open Food Facts database.

    Open Food Facts is a free, open database of food products from around the world.
    No configuration required - works globally.
    """
)
async def lookup_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user)
):
    """Look up a barcode in Open Food Facts."""
    result = await openfoodfacts_client.lookup_barcode(barcode)

    return ProductLookupResponse(
        found=result["found"],
        barcode=result["barcode"],
        product_name=result.get("product_name"),
        brand=result.get("brand"),
        image_url=result.get("image_url"),
        quantity=result.get("quantity"),
        categories=result.get("categories"),
        nutriscore=result.get("nutriscore"),
        error=result.get("error")
    )
