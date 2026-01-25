"""
Product Catalog API Endpoints

Endpoints for viewing and managing the local product catalog.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.product_catalog import ProductCatalog
from app.services.product_enrichment import get_queue_status


router = APIRouter(prefix="/product-catalog")


class ProductCatalogResponse(BaseModel):
    """Response schema for product catalog entry."""
    id: UUID
    barcode: str
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity_text: Optional[str] = None
    categories: Optional[str] = None
    energy_kcal: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    nutriscore: Optional[str] = None
    image_url: Optional[str] = None
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCatalogListResponse(BaseModel):
    """Response schema for product catalog list."""
    products: List[ProductCatalogResponse]
    total: int
    limit: int
    offset: int


class EnrichmentQueueStatus(BaseModel):
    """Response schema for enrichment queue status."""
    queue_size: int
    worker_running: bool


@router.get("", response_model=ProductCatalogListResponse)
def get_product_catalog(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by name or barcode"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all products in the local catalog.
    """
    query = db.query(ProductCatalog)

    # Filter out "not_found" entries
    query = query.filter(ProductCatalog.source != "not_found")

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (ProductCatalog.name.ilike(search_term)) |
            (ProductCatalog.brand.ilike(search_term)) |
            (ProductCatalog.barcode.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Get products with pagination
    products = query.order_by(ProductCatalog.created_at.desc()).offset(offset).limit(limit).all()

    return ProductCatalogListResponse(
        products=products,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/barcode/{barcode}", response_model=ProductCatalogResponse)
def get_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a product by barcode from the local catalog.
    """
    product = db.query(ProductCatalog).filter(ProductCatalog.barcode == barcode).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato nel catalogo locale"
        )

    if product.source == "not_found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non disponibile in Open Food Facts"
        )

    return product


@router.get("/enrichment-status", response_model=EnrichmentQueueStatus)
def get_enrichment_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get the current status of the product enrichment queue.
    """
    return get_queue_status()


@router.delete("/barcode/{barcode}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_by_barcode(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a product from the local catalog (allows re-fetch from API).
    """
    product = db.query(ProductCatalog).filter(ProductCatalog.barcode == barcode).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato nel catalogo locale"
        )

    db.delete(product)
    db.commit()
