"""
Dispensa API Endpoints
CRUD operations for dispensa (pantry) items.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from uuid import UUID
from collections import defaultdict
from pydantic import BaseModel

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.product_catalog import ProductCatalog
from app.models.product_barcode import ProductBarcode
from app.models.brand import Brand
from app.models.dispensa import DispensaItem
from app.services.dispensa_service import DispensaService
from app.schemas.dispensa import (
    DispensaItemCreate,
    DispensaItemUpdate,
    DispensaItemResponse,
    DispensaItemListResponse,
    DispensaStatsResponse,
    SendToDispensaRequest,
    ConsumeItemRequest,
    PreviewFromShoppingListRequest,
    PreviewFromShoppingListResponse,
    ScanMissingCatalogsResponse,
    MissingCatalogItem,
    ConflictCatalogItem,
    ApplyMissingCatalogsRequest,
    ApplyMissingCatalogsResponse,
)


router = APIRouter(prefix="/dispensa")


@router.get("", response_model=DispensaItemListResponse)
def get_dispensa_items(
    house_id: UUID = Query(..., description="House ID"),
    search: Optional[str] = Query(None, description="Search by name"),
    category_id: Optional[UUID] = Query(None, description="Filter by category"),
    expiring: bool = Query(False, description="Show only expiring soon (3 days)"),
    expired: bool = Query(False, description="Show only expired"),
    consumed: bool = Query(False, description="Show consumed items"),
    show_all: bool = Query(False, description="Show all items regardless of consumed status"),
    area_id: Optional[UUID] = Query(None, description="Filter by area"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all dispensa items for a house with optional filters."""
    items = DispensaService.get_items(
        db, house_id,
        search=search,
        category_id=category_id,
        expiring=expiring,
        expired=expired,
        consumed=consumed,
        show_all=show_all,
        area_id=area_id,
    )
    stats_data = DispensaService.get_stats(db, house_id, area_id=area_id)
    total = len(items)

    return DispensaItemListResponse(
        items=items,
        total=total,
        stats=DispensaStatsResponse(**stats_data),
    )


@router.post("", response_model=DispensaItemResponse, status_code=status.HTTP_201_CREATED)
def create_dispensa_item(
    house_id: UUID = Query(..., description="House ID"),
    data: DispensaItemCreate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new dispensa item. Merges with existing if same name+unit."""
    item = DispensaService.create_item(db, house_id, current_user.id, data)
    db.commit()
    db.refresh(item)
    return item


@router.get("/stats", response_model=DispensaStatsResponse)
def get_dispensa_stats(
    house_id: UUID = Query(..., description="House ID"),
    area_id: Optional[UUID] = Query(None, description="Filter by area"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dispensa statistics (totals, expiring, expired)."""
    return DispensaService.get_stats(db, house_id, area_id=area_id)


@router.post("/preview-from-shopping-list", response_model=PreviewFromShoppingListResponse)
def preview_from_shopping_list(
    data: PreviewFromShoppingListRequest,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Preview items from a shopping list with resolved areas before sending to dispensa."""
    result = DispensaService.preview_from_shopping_list(
        db, house_id, data.shopping_list_id
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista non trovata"
        )
    return result


@router.post("/from-shopping-list")
def send_from_shopping_list(
    data: SendToDispensaRequest,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send verified items from a shopping list to the dispensa."""
    result = DispensaService.send_from_shopping_list(
        db, house_id, current_user.id, data.shopping_list_id,
        item_areas=data.item_areas,
        item_expiry_extensions=data.item_expiry_extensions,
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )

    db.commit()
    return {"message": f"{result['count']} articoli inviati alla dispensa", "count": result["count"]}


@router.get("/missing-catalogs", response_model=ScanMissingCatalogsResponse)
def scan_missing_catalogs(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan dispensa items and find those without a ProductCatalog entry."""
    # Get active dispensa items with barcode
    items_with_barcode = (
        db.query(DispensaItem)
        .filter(
            DispensaItem.house_id == house_id,
            DispensaItem.is_consumed == False,
            DispensaItem.barcode.isnot(None),
            DispensaItem.barcode != "",
        )
        .all()
    )

    # Count items without barcode
    no_barcode = (
        db.query(func.count(DispensaItem.id))
        .filter(
            DispensaItem.house_id == house_id,
            DispensaItem.is_consumed == False,
            (DispensaItem.barcode.is_(None)) | (DispensaItem.barcode == ""),
        )
        .scalar()
    )

    # Group by barcode
    by_barcode: dict[str, list] = defaultdict(list)
    for item in items_with_barcode:
        by_barcode[item.barcode].append(item)

    to_create: list[MissingCatalogItem] = []
    conflicts: list[ConflictCatalogItem] = []
    already_linked = 0

    for barcode, dispensa_items in by_barcode.items():
        representative = dispensa_items[0]
        item_ids = [item.id for item in dispensa_items]

        # Look up ProductBarcode
        pb = db.query(ProductBarcode).filter(ProductBarcode.barcode == barcode).first()

        if not pb:
            # No barcode entry at all → to_create
            to_create.append(MissingCatalogItem(
                barcode=barcode,
                dispensa_name=representative.name,
                brand_text=representative.brand_text,
                dispensa_item_ids=item_ids,
            ))
            continue

        # Barcode exists, check product
        product = db.query(ProductCatalog).filter(ProductCatalog.id == pb.product_id).first()

        if not product or product.cancelled:
            # Product cancelled or missing → to_create
            to_create.append(MissingCatalogItem(
                barcode=barcode,
                dispensa_name=representative.name,
                brand_text=representative.brand_text,
                dispensa_item_ids=item_ids,
            ))
            continue

        # Product exists and active — compare names
        if product.name.strip().lower() == representative.name.strip().lower():
            already_linked += 1
        else:
            conflicts.append(ConflictCatalogItem(
                barcode=barcode,
                dispensa_name=representative.name,
                catalog_name=product.name,
                product_id=product.id,
                dispensa_item_ids=item_ids,
            ))

    return ScanMissingCatalogsResponse(
        to_create=to_create,
        conflicts=conflicts,
        already_linked=already_linked,
        no_barcode=no_barcode,
    )


@router.post("/missing-catalogs/apply", response_model=ApplyMissingCatalogsResponse)
def apply_missing_catalogs(
    data: ApplyMissingCatalogsRequest,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create missing ProductCatalog entries and resolve conflicts."""
    created = 0
    conflicts_resolved = 0
    errors: list[str] = []

    # --- Create missing catalog entries ---
    for item in data.create_items:
        # Double-check barcode doesn't already exist
        existing_pb = db.query(ProductBarcode).filter(ProductBarcode.barcode == item.barcode).first()
        if existing_pb:
            # Check if product is cancelled → reactivate
            existing_product = db.query(ProductCatalog).filter(ProductCatalog.id == existing_pb.product_id).first()
            if existing_product and existing_product.cancelled:
                existing_product.cancelled = False
                existing_product.name = item.name
                created += 1
                continue
            errors.append(f"Barcode {item.barcode} già esistente in anagrafica")
            continue

        # Find-or-create brand
        brand_id = None
        brand_name = None
        if item.brand_text and item.brand_text.strip():
            brand_name = item.brand_text.strip()
            brand = db.query(Brand).filter(func.lower(Brand.name) == brand_name.lower()).first()
            if brand:
                if brand.cancelled:
                    brand.cancelled = False
            else:
                brand = Brand(name=brand_name)
                db.add(brand)
                db.flush()
            brand_id = brand.id

        # Create ProductCatalog
        product = ProductCatalog(
            house_id=house_id,
            name=item.name,
            barcode=item.barcode,
            brand=brand_name,
            brand_id=brand_id,
            source="manual",
        )
        db.add(product)
        db.flush()

        # Create ProductBarcode
        db.add(ProductBarcode(
            product_id=product.id,
            barcode=item.barcode,
            is_primary=True,
            source="manual",
        ))
        created += 1

    # --- Resolve conflicts ---
    for resolution in data.conflict_resolutions:
        pb = db.query(ProductBarcode).filter(ProductBarcode.barcode == resolution.barcode).first()
        if not pb:
            errors.append(f"Barcode {resolution.barcode} non trovato")
            continue

        product = db.query(ProductCatalog).filter(ProductCatalog.id == pb.product_id).first()
        if not product:
            errors.append(f"Prodotto per barcode {resolution.barcode} non trovato")
            continue

        if resolution.keep == "dispensa":
            # Get the dispensa name for this barcode
            dispensa_item = (
                db.query(DispensaItem)
                .filter(
                    DispensaItem.house_id == house_id,
                    DispensaItem.barcode == resolution.barcode,
                    DispensaItem.is_consumed == False,
                )
                .first()
            )
            if dispensa_item:
                product.name = dispensa_item.name
        elif resolution.keep == "catalog":
            # Update all dispensa items with this barcode to match catalog name
            db.query(DispensaItem).filter(
                DispensaItem.house_id == house_id,
                DispensaItem.barcode == resolution.barcode,
                DispensaItem.is_consumed == False,
            ).update({DispensaItem.name: product.name})

        conflicts_resolved += 1

    db.commit()

    return ApplyMissingCatalogsResponse(
        created=created,
        conflicts_resolved=conflicts_resolved,
        errors=errors,
    )


@router.get("/{item_id}", response_model=DispensaItemResponse)
def get_dispensa_item(
    item_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single dispensa item by ID."""
    item = DispensaService.get_item_by_id(db, item_id, house_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )
    return item


@router.put("/{item_id}", response_model=DispensaItemResponse)
def update_dispensa_item(
    item_id: UUID,
    data: DispensaItemUpdate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a dispensa item."""
    item = DispensaService.update_item(db, item_id, house_id, data)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dispensa_item(
    item_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a dispensa item."""
    deleted = DispensaService.delete_item(db, item_id, house_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )
    db.commit()


@router.post("/{item_id}/consume", response_model=DispensaItemResponse)
def consume_dispensa_item(
    item_id: UUID,
    data: ConsumeItemRequest = ConsumeItemRequest(),
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Consume a dispensa item (total or partial)."""
    item = DispensaService.consume_item(db, item_id, house_id, data.quantity)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/unconsume", response_model=DispensaItemResponse)
def unconsume_dispensa_item(
    item_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a consumed dispensa item."""
    item = DispensaService.unconsume_item(db, item_id, house_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )
    db.commit()
    db.refresh(item)
    return item
