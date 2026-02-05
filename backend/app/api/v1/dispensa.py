"""
Dispensa API Endpoints
CRUD operations for dispensa (pantry) items.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.services.dispensa_service import DispensaService
from app.schemas.dispensa import (
    DispensaItemCreate,
    DispensaItemUpdate,
    DispensaItemResponse,
    DispensaItemListResponse,
    DispensaStatsResponse,
    SendToDispensaRequest,
    ConsumeItemRequest,
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
    )
    stats_data = DispensaService.get_stats(db, house_id)
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dispensa statistics (totals, expiring, expired)."""
    return DispensaService.get_stats(db, house_id)


@router.post("/from-shopping-list")
def send_from_shopping_list(
    data: SendToDispensaRequest,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send verified items from a shopping list to the dispensa."""
    result = DispensaService.send_from_shopping_list(
        db, house_id, current_user.id, data.shopping_list_id
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result["error"]
        )

    db.commit()
    return {"message": f"{result['count']} articoli inviati alla dispensa", "count": result["count"]}


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
