"""
Product Catalog API Endpoints
CRUD operations for the local product catalog.
Each house has its own product catalog. house_id=null are global templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.product_catalog import ProductCatalog
from app.models.product_barcode import ProductBarcode
from app.models.user_house import UserHouse
from app.services.product_enrichment import get_queue_status


def _get_product_by_barcode_in_house(db: Session, barcode: str, house_id):
    """Lookup ProductCatalog in a house via ProductBarcode table."""
    return db.query(ProductCatalog).join(
        ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
    ).filter(
        ProductBarcode.barcode == barcode,
        ProductCatalog.house_id == house_id
    ).first()


router = APIRouter(prefix="/product-catalog")


def verify_house_access(db: Session, user_id: UUID, house_id: UUID) -> bool:
    """Verify user has access to the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()
    return membership is not None


class ProductCatalogResponse(BaseModel):
    """Response schema for product catalog entry."""
    id: UUID
    house_id: Optional[UUID] = None
    barcode: Optional[str] = None
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


class ProductSuggestion(BaseModel):
    """Single product suggestion."""
    name: str
    brand: Optional[str] = None
    barcode: Optional[str] = None
    user_notes: Optional[str] = None


class ProductSuggestResponse(BaseModel):
    """Response schema for product suggestions."""
    suggestions: List[ProductSuggestion]


@router.get("/suggest", response_model=ProductSuggestResponse)
def suggest_products(
    q: str = Query(..., min_length=3),
    house_id: UUID = Query(...),
    limit: int = Query(10, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Suggest products from the local catalog by word-boundary prefix match.
    Used for autocomplete in shopping list forms.
    """
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Search in house products + global templates (house_id IS NULL)
    query = db.query(ProductCatalog).filter(
        or_(
            ProductCatalog.house_id == house_id,
            ProductCatalog.house_id.is_(None),
        ),
        ProductCatalog.cancelled == False,
        ProductCatalog.name.isnot(None),
        ProductCatalog.name != "",
    ).filter(
        or_(
            ProductCatalog.name.ilike(f"{q}%"),
            ProductCatalog.name.ilike(f"% {q}%"),
        )
    ).order_by(ProductCatalog.name).limit(limit)

    # Deduplicate by name (house product wins over template)
    seen_names: set[str] = set()
    products = []
    for p in query.all():
        name_lower = p.name.lower()
        if name_lower not in seen_names:
            seen_names.add(name_lower)
            products.append(p)

    # Batch load primary barcodes
    product_ids = [p.id for p in products]
    bc_map: dict = {}
    if product_ids:
        barcodes = db.query(ProductBarcode).filter(
            ProductBarcode.product_id.in_(product_ids)
        ).all()
        for pb in barcodes:
            pid = str(pb.product_id)
            if pid not in bc_map or pb.is_primary:
                bc_map[pid] = pb.barcode

    return ProductSuggestResponse(
        suggestions=[
            ProductSuggestion(
                name=p.name,
                brand=p.brand,
                barcode=bc_map.get(str(p.id), p.barcode),
                user_notes=p.user_notes
            )
            for p in products
        ]
    )


@router.get("", response_model=ProductCatalogListResponse)
def get_product_catalog(
    house_id: UUID = Query(..., description="House ID"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by name or barcode"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all products in the local catalog for a house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    query = db.query(ProductCatalog).filter(ProductCatalog.house_id == house_id)

    # Filter out "not_found" entries
    query = query.filter(ProductCatalog.source != "not_found")

    # Apply search filter
    if search:
        search_term = f"%{search}%"
        barcode_subq = db.query(ProductBarcode.product_id).filter(
            ProductBarcode.barcode.ilike(search_term)
        ).subquery()
        query = query.filter(
            (ProductCatalog.name.ilike(search_term)) |
            (ProductCatalog.brand.ilike(search_term)) |
            (ProductCatalog.id.in_(barcode_subq))
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


@router.get("/templates", response_model=ProductCatalogListResponse)
def get_template_products(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by name or barcode"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global template products (house_id=null).
    These can be imported into a house.
    """
    query = db.query(ProductCatalog).filter(ProductCatalog.house_id.is_(None))
    query = query.filter(ProductCatalog.source != "not_found")

    if search:
        search_term = f"%{search}%"
        barcode_subq = db.query(ProductBarcode.product_id).filter(
            ProductBarcode.barcode.ilike(search_term)
        ).subquery()
        query = query.filter(
            (ProductCatalog.name.ilike(search_term)) |
            (ProductCatalog.brand.ilike(search_term)) |
            (ProductCatalog.id.in_(barcode_subq))
        )

    total = query.count()
    products = query.order_by(ProductCatalog.created_at.desc()).offset(offset).limit(limit).all()

    return ProductCatalogListResponse(
        products=products,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/import-templates", status_code=status.HTTP_201_CREATED)
def import_template_products(
    house_id: UUID = Query(..., description="House ID to import into"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import global template products into a house.
    Skips products that already exist in the house (by barcode).
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Get template products
    templates = db.query(ProductCatalog).filter(
        ProductCatalog.house_id.is_(None),
        ProductCatalog.source != "not_found"
    ).all()

    # Get existing barcodes in house (from product_barcodes)
    existing_barcodes = set(
        bc for (bc,) in db.query(ProductBarcode.barcode).join(
            ProductCatalog, ProductCatalog.id == ProductBarcode.product_id
        ).filter(
            ProductCatalog.house_id == house_id
        ).all()
    )

    imported = 0
    for template in templates:
        # Get template's primary barcode
        template_pb = db.query(ProductBarcode).filter(
            ProductBarcode.product_id == template.id,
            ProductBarcode.is_primary == True
        ).first()
        template_barcode = (template_pb.barcode if template_pb else None) or template.barcode
        if not template_barcode:
            continue
        if template_barcode not in existing_barcodes:
            new_product = ProductCatalog(
                house_id=house_id,
                barcode=template_barcode,
                name=template.name,
                brand=template.brand,
                quantity_text=template.quantity_text,
                categories=template.categories,
                energy_kcal=template.energy_kcal,
                proteins_g=template.proteins_g,
                carbs_g=template.carbs_g,
                sugars_g=template.sugars_g,
                fats_g=template.fats_g,
                saturated_fats_g=template.saturated_fats_g,
                fiber_g=template.fiber_g,
                salt_g=template.salt_g,
                nutriscore=template.nutriscore,
                ecoscore=template.ecoscore,
                nova_group=template.nova_group,
                image_url=template.image_url,
                image_small_url=template.image_small_url,
                source=template.source,
                raw_data=template.raw_data,
            )
            db.add(new_product)
            db.flush()
            db.add(ProductBarcode(
                product_id=new_product.id,
                barcode=template_barcode,
                is_primary=True,
                source=template.source
            ))
            imported += 1

    db.commit()

    return {"message": f"Importati {imported} prodotti", "imported": imported}


@router.get("/barcode/{barcode}", response_model=ProductCatalogResponse)
def get_product_by_barcode(
    barcode: str,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a product by barcode from the local catalog.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    product = _get_product_by_barcode_in_house(db, barcode, house_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato nel catalogo locale"
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
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a product from the local catalog (allows re-fetch from API).
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    product = _get_product_by_barcode_in_house(db, barcode, house_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prodotto non trovato nel catalogo locale"
        )

    db.delete(product)
    db.commit()
