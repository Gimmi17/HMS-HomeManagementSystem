"""
Shopping Lists API Endpoints

CRUD operations for shopping lists with Grocy integration.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone
import re
import logging

from app.db.session import get_db, SessionLocal
from app.services.error_logging import error_logger

# Logger for load verification operations
verification_logger = logging.getLogger("load_verification")
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.shopping_list import ShoppingList, ShoppingListItem, ShoppingListStatus, VerificationStatus
from app.models.store import Store
from app.services.product_enrichment import enrich_product_background
from app.schemas.shopping_list import (
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingListResponse,
    ShoppingListSummary,
    ShoppingListsResponse,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListItemResponse,
    EditLockResponse,
)


router = APIRouter(prefix="/shopping-lists")


def build_list_response(shopping_list: ShoppingList) -> ShoppingListResponse:
    """Helper to build ShoppingListResponse with store_name."""
    return ShoppingListResponse(
        id=shopping_list.id,
        house_id=shopping_list.house_id,
        store_id=shopping_list.store_id,
        store_name=shopping_list.store.name if shopping_list.store else None,
        name=shopping_list.name,
        created_by=shopping_list.created_by,
        status=shopping_list.status,
        verification_status=shopping_list.verification_status,
        editing_by=shopping_list.editing_by,
        editing_since=shopping_list.editing_since,
        items=shopping_list.items,
        created_at=shopping_list.created_at,
        updated_at=shopping_list.updated_at
    )


def generate_list_name(db: Session, house_id: UUID) -> str:
    """
    Generate a unique list name for today.

    Format: "Lista del DD/MM/YYYY" or "Lista del DD/MM/YYYY-N" if duplicates exist.
    """
    today = datetime.now(timezone.utc).date()
    base_name = f"Lista del {today.strftime('%d/%m/%Y')}"

    # Find existing lists for today with similar names
    existing_lists = db.query(ShoppingList.name).filter(
        ShoppingList.house_id == house_id,
        ShoppingList.name.like(f"{base_name}%")
    ).all()

    existing_names = {lst.name for lst in existing_lists}

    # If base name doesn't exist, use it
    if base_name not in existing_names:
        return base_name

    # Find the next available suffix
    suffix = 1
    while f"{base_name}-{suffix}" in existing_names:
        suffix += 1

    return f"{base_name}-{suffix}"


@router.post("", response_model=ShoppingListResponse, status_code=status.HTTP_201_CREATED)
def create_shopping_list(
    data: ShoppingListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new shopping list.

    Creates a shopping list with optional initial items.
    The list is created with status 'active'.
    If name is not provided, generates "Lista del DD/MM/YYYY" with suffix if needed.
    """
    # Generate name if not provided
    list_name = data.name if data.name else generate_list_name(db, data.house_id)

    # Create the shopping list
    shopping_list = ShoppingList(
        house_id=data.house_id,
        store_id=data.store_id,
        created_by=current_user.id,
        name=list_name,
        status=ShoppingListStatus.ACTIVE
    )
    db.add(shopping_list)
    db.flush()  # Get the ID before adding items

    # Add items if provided
    for idx, item_data in enumerate(data.items):
        item = ShoppingListItem(
            shopping_list_id=shopping_list.id,
            position=item_data.position if item_data.position is not None else idx,
            name=item_data.name,
            grocy_product_id=item_data.grocy_product_id,
            grocy_product_name=item_data.grocy_product_name,
            quantity=item_data.quantity,
            unit=item_data.unit
        )
        db.add(item)

    db.commit()
    db.refresh(shopping_list)

    return build_list_response(shopping_list)


@router.get("", response_model=ShoppingListsResponse)
def get_shopping_lists(
    house_id: UUID = Query(..., description="House ID"),
    status_filter: Optional[ShoppingListStatus] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all shopping lists for a house.

    Returns a paginated list of shopping lists with item counts.
    """
    # Base query
    query = db.query(ShoppingList).filter(ShoppingList.house_id == house_id)

    # Apply status filter
    if status_filter:
        query = query.filter(ShoppingList.status == status_filter)

    # Get total count
    total = query.count()

    # Get lists with pagination
    lists = query.order_by(ShoppingList.created_at.desc()).offset(offset).limit(limit).all()

    # Build summaries with item counts
    summaries = []
    for lst in lists:
        item_count = len(lst.items)
        checked_count = sum(1 for item in lst.items if item.checked)
        verified_count = sum(1 for item in lst.items if item.verified_at is not None)
        not_purchased_count = sum(1 for item in lst.items if item.not_purchased)
        summaries.append(ShoppingListSummary(
            id=lst.id,
            house_id=lst.house_id,
            store_id=lst.store_id,
            store_name=lst.store.name if lst.store else None,
            name=lst.name,
            status=lst.status,
            verification_status=lst.verification_status,
            item_count=item_count,
            checked_count=checked_count,
            verified_count=verified_count,
            not_purchased_count=not_purchased_count,
            created_at=lst.created_at,
            updated_at=lst.updated_at
        ))

    return ShoppingListsResponse(
        lists=summaries,
        total=total,
        limit=limit,
        offset=offset
    )


def get_store_order_map(db: Session, store_id: Optional[UUID], exclude_list_id: UUID) -> dict:
    """
    Build a map of item name -> order index based on check order from previous completed lists.
    Uses the most recent completed list's check order for a specific store.
    Store ordering is shared across ALL houses that shop at the same store.
    """
    if not store_id:
        return {}

    # Find the most recent completed list for this store (across all houses)
    last_completed = db.query(ShoppingList).filter(
        ShoppingList.store_id == store_id,
        ShoppingList.status == ShoppingListStatus.COMPLETED,
        ShoppingList.id != exclude_list_id
    ).order_by(ShoppingList.updated_at.desc()).first()

    if not last_completed:
        return {}

    # Get items sorted by checked_at (the order they were checked in store)
    items = db.query(ShoppingListItem).filter(
        ShoppingListItem.shopping_list_id == last_completed.id,
        ShoppingListItem.checked == True,
        ShoppingListItem.checked_at.isnot(None)
    ).order_by(ShoppingListItem.checked_at).all()

    # Build order map: item name (lowercase) -> order index
    order_map = {}
    for idx, item in enumerate(items):
        name_key = item.name.lower().strip()
        if name_key not in order_map:
            order_map[name_key] = idx
        # Also map by grocy_product_id if available
        if item.grocy_product_id:
            order_map[f"grocy:{item.grocy_product_id}"] = idx

    return order_map


@router.get("/{list_id}", response_model=ShoppingListResponse)
def get_shopping_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single shopping list with all items.
    Items are sorted based on store order learned from previous completed lists.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Get store order from previous lists (uses store_id for shared ordering across houses)
    order_map = get_store_order_map(db, shopping_list.store_id, list_id)

    if order_map:
        # Sort items based on store order
        def get_sort_key(item):
            # First try grocy product id
            if item.grocy_product_id:
                key = f"grocy:{item.grocy_product_id}"
                if key in order_map:
                    return (0, order_map[key])
            # Then try name match
            name_key = item.name.lower().strip()
            if name_key in order_map:
                return (0, order_map[name_key])
            # Unknown items go to the end, sorted by position
            return (1, item.position)

        shopping_list.items = sorted(shopping_list.items, key=get_sort_key)

    return build_list_response(shopping_list)


@router.put("/{list_id}", response_model=ShoppingListResponse)
def update_shopping_list(
    list_id: UUID,
    data: ShoppingListUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a shopping list (name or status).
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Log verification status changes
    old_verification_status = shopping_list.verification_status

    if data.name is not None:
        shopping_list.name = data.name
    if data.store_id is not None:
        shopping_list.store_id = data.store_id
    if data.status is not None:
        shopping_list.status = data.status
    if data.verification_status is not None:
        shopping_list.verification_status = data.verification_status

    try:
        db.commit()
        db.refresh(shopping_list)

        # Log verification status change
        if data.verification_status is not None and data.verification_status != old_verification_status:
            verification_logger.info(
                f"VERIFICATION_STATUS_CHANGE | list_id={list_id} | "
                f"old_status={old_verification_status} | new_status={data.verification_status} | "
                f"user={current_user.email}"
            )

        return build_list_response(shopping_list)

    except Exception as e:
        db.rollback()
        verification_logger.error(
            f"UPDATE_LIST_ERROR | list_id={list_id} | error={str(e)} | user={current_user.email}"
        )
        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "update_shopping_list",
                "list_id": str(list_id),
                "data": data.model_dump(exclude_unset=True)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante l'aggiornamento: {str(e)}"
        )


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shopping_list(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a shopping list and all its items.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    db.delete(shopping_list)
    db.commit()


# Item Endpoints

@router.post("/{list_id}/items", response_model=ShoppingListItemResponse, status_code=status.HTTP_201_CREATED)
def add_item_to_list(
    list_id: UUID,
    data: ShoppingListItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new item to a shopping list.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Get max position
    max_position = db.query(func.max(ShoppingListItem.position)).filter(
        ShoppingListItem.shopping_list_id == list_id
    ).scalar() or -1

    item = ShoppingListItem(
        shopping_list_id=list_id,
        position=data.position if data.position is not None else max_position + 1,
        name=data.name,
        grocy_product_id=data.grocy_product_id,
        grocy_product_name=data.grocy_product_name,
        quantity=data.quantity,
        unit=data.unit
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@router.put("/{list_id}/items/{item_id}", response_model=ShoppingListItemResponse)
def update_item(
    list_id: UUID,
    item_id: UUID,
    data: ShoppingListItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a shopping list item.
    """
    verification_logger.info(
        f"UPDATE_ITEM_START | list_id={list_id} | item_id={item_id} | "
        f"data={data.model_dump(exclude_unset=True)} | user={current_user.email}"
    )

    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        verification_logger.warning(f"UPDATE_ITEM_NOT_FOUND | item_id={item_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    try:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)

        db.commit()
        db.refresh(item)

        verification_logger.info(
            f"UPDATE_ITEM_SUCCESS | list_id={list_id} | item_id={item_id} | item_name={item.name}"
        )

        return item

    except Exception as e:
        db.rollback()
        verification_logger.error(
            f"UPDATE_ITEM_ERROR | list_id={list_id} | item_id={item_id} | error={str(e)}"
        )
        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "update_item",
                "list_id": str(list_id),
                "item_id": str(item_id),
                "data": data.model_dump(exclude_unset=True)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante l'aggiornamento: {str(e)}"
        )


@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    list_id: UUID,
    item_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete an item from a shopping list.
    """
    verification_logger.info(
        f"DELETE_ITEM_START | list_id={list_id} | item_id={item_id} | user={current_user.email}"
    )

    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        verification_logger.warning(f"DELETE_ITEM_NOT_FOUND | item_id={item_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    try:
        item_name = item.name
        db.delete(item)
        db.commit()
        verification_logger.info(
            f"DELETE_ITEM_SUCCESS | list_id={list_id} | item_id={item_id} | item_name={item_name}"
        )

    except Exception as e:
        db.rollback()
        verification_logger.error(
            f"DELETE_ITEM_ERROR | list_id={list_id} | item_id={item_id} | error={str(e)}"
        )
        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "delete_item",
                "list_id": str(list_id),
                "item_id": str(item_id)
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante l'eliminazione: {str(e)}"
        )


@router.post("/{list_id}/items/{item_id}/toggle-check", response_model=ShoppingListItemResponse)
def toggle_item_check(
    list_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle the checked status of an item.
    Records checked_at timestamp for store ordering feature.
    """
    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    item.checked = not item.checked
    # Track when item was checked for store ordering
    if item.checked:
        item.checked_at = datetime.now(timezone.utc)
    else:
        item.checked_at = None

    db.commit()
    db.refresh(item)

    return item


@router.post("/{list_id}/items/{item_id}/verify", response_model=ShoppingListItemResponse)
def verify_item(
    list_id: UUID,
    item_id: UUID,
    barcode: str = Query(..., description="Scanned barcode"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify an item by scanning its barcode during load check.
    Records the barcode and verification timestamp.
    """
    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    # Set barcode and verification timestamp
    item.scanned_barcode = barcode
    item.verified_at = datetime.now(timezone.utc)
    # Mark as checked/purchased when verified
    item.checked = True
    item.checked_at = datetime.now(timezone.utc)
    # Clear not_purchased if it was previously set
    item.not_purchased = False
    item.not_purchased_at = None

    db.commit()
    db.refresh(item)

    return item


@router.post("/{list_id}/items/{item_id}/not-purchased", response_model=ShoppingListItemResponse)
def mark_item_not_purchased(
    list_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark an item as not purchased (not available at store) during load check.
    This counts as verified but logs that the item wasn't found.
    """
    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    # Mark as not purchased and verified
    item.not_purchased = True
    item.not_purchased_at = datetime.now(timezone.utc)
    item.verified_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(item)

    return item


class VerifyWithQuantityRequest(BaseModel):
    barcode: str
    quantity: float
    unit: str
    product_name: Optional[str] = None


class AddExtraItemRequest(BaseModel):
    """Request to add an extra item during load verification."""
    barcode: str
    quantity: float
    unit: str
    product_name: Optional[str] = None


@router.post("/{list_id}/items/{item_id}/verify-with-quantity", response_model=ShoppingListItemResponse)
def verify_item_with_quantity(
    list_id: UUID,
    item_id: UUID,
    data: VerifyWithQuantityRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify an item with barcode and quantity during load check.
    Saves immediately for offline resilience.
    Triggers background task to enrich product data.
    """
    verification_logger.info(
        f"VERIFY_ITEM_START | list_id={list_id} | item_id={item_id} | "
        f"barcode={data.barcode} | quantity={data.quantity} | unit={data.unit} | "
        f"user={current_user.email}"
    )

    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.id == item_id,
        ShoppingListItem.shopping_list_id == list_id
    ).first()

    if not item:
        verification_logger.warning(f"VERIFY_ITEM_NOT_FOUND | item_id={item_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Articolo non trovato"
        )

    try:
        # Save verification data immediately
        item.scanned_barcode = data.barcode
        item.verified_quantity = data.quantity
        item.verified_unit = data.unit
        item.verified_at = datetime.now(timezone.utc)
        # Mark as checked/purchased when verified
        item.checked = True
        item.checked_at = datetime.now(timezone.utc)
        # Clear not_purchased if it was previously set
        item.not_purchased = False
        item.not_purchased_at = None

        # Save product name if found via API
        if data.product_name:
            item.grocy_product_name = data.product_name

        db.commit()
        db.refresh(item)

        verification_logger.info(
            f"VERIFY_ITEM_SUCCESS | list_id={list_id} | item_id={item_id} | "
            f"item_name={item.name} | barcode={data.barcode}"
        )

    except Exception as e:
        db.rollback()
        verification_logger.error(
            f"VERIFY_ITEM_ERROR | list_id={list_id} | item_id={item_id} | error={str(e)}"
        )
        error_logger.log_error(
            e,
            request=request,
            user=current_user,
            severity="error",
            context={
                "operation": "verify_item_with_quantity",
                "list_id": str(list_id),
                "item_id": str(item_id),
                "barcode": data.barcode,
                "quantity": data.quantity,
                "unit": data.unit
            }
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante la verifica: {str(e)}"
        )

    # Trigger background task to enrich product data
    # This will check local DB, then Open Food Facts, and save product info
    # Pass item_id so the item can be updated with product name once enriched
    enrich_product_background(SessionLocal, data.barcode, item_id=item_id, list_id=list_id)

    return item


# Lock timeout in minutes - after this, lock can be overridden
LOCK_TIMEOUT_MINUTES = 30


@router.post("/{list_id}/lock", response_model=EditLockResponse)
def acquire_edit_lock(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Acquire edit lock for a shopping list.

    Only one user can edit at a time. Lock expires after 30 minutes.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    now = datetime.now(timezone.utc)

    # Check if someone else is editing
    if shopping_list.editing_by and shopping_list.editing_by != current_user.id:
        # Check if lock has expired
        if shopping_list.editing_since:
            lock_age = (now - shopping_list.editing_since).total_seconds() / 60
            if lock_age < LOCK_TIMEOUT_MINUTES:
                # Lock is still valid, get editor name
                editor = db.query(User).filter(User.id == shopping_list.editing_by).first()
                editor_name = editor.full_name if editor else "Un altro utente"
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail=f"Lista in modifica da {editor_name}. Riprova più tardi."
                )

    # Acquire lock
    shopping_list.editing_by = current_user.id
    shopping_list.editing_since = now
    db.commit()

    return EditLockResponse(
        success=True,
        message="Lock acquisito",
        editing_by=current_user.id,
        editor_name=current_user.full_name
    )


@router.post("/{list_id}/unlock", response_model=EditLockResponse)
def release_edit_lock(
    list_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Release edit lock for a shopping list.

    Only the user who holds the lock can release it.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Only release if current user holds the lock
    if shopping_list.editing_by == current_user.id:
        shopping_list.editing_by = None
        shopping_list.editing_since = None
        db.commit()

    return EditLockResponse(
        success=True,
        message="Lock rilasciato",
        editing_by=None,
        editor_name=None
    )


@router.post("/{list_id}/items/extra", response_model=ShoppingListItemResponse, status_code=status.HTTP_201_CREATED)
def add_extra_item(
    list_id: UUID,
    data: AddExtraItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add an extra item during load verification.

    This is for products that were purchased but weren't originally on the list.
    The item is created already verified, with barcode as temporary name.
    Background enrichment will update the name once product info is found.
    """
    shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lista della spesa non trovata"
        )

    # Get max position
    max_position = db.query(func.max(ShoppingListItem.position)).filter(
        ShoppingListItem.shopping_list_id == list_id
    ).scalar() or -1

    # Create item with barcode as temporary name, or product name if provided
    temp_name = data.product_name if data.product_name else f"Prodotto: {data.barcode}"

    item = ShoppingListItem(
        shopping_list_id=list_id,
        position=max_position + 1,
        name=temp_name,
        quantity=int(data.quantity) if data.unit == 'pz' else 1,
        unit=data.unit,
        # Already verified
        scanned_barcode=data.barcode,
        verified_quantity=data.quantity,
        verified_unit=data.unit,
        verified_at=datetime.now(timezone.utc),
        # Also mark as checked
        checked=True,
        checked_at=datetime.now(timezone.utc),
    )

    # Set grocy_product_name if we have product name (for display)
    if data.product_name:
        item.grocy_product_name = data.product_name

    db.add(item)
    db.commit()
    db.refresh(item)

    # Trigger background enrichment - this will also update other items with same barcode
    enrich_product_background(SessionLocal, data.barcode, item_id=item.id, list_id=list_id)

    return item


class NotPurchasedItemResponse(BaseModel):
    """Response for not purchased items from last completed list."""
    id: str
    name: str
    grocy_product_id: Optional[int] = None
    grocy_product_name: Optional[str] = None
    quantity: float
    unit: Optional[str] = None


class NotPurchasedRecoveryResponse(BaseModel):
    """Response for not purchased items recovery endpoint."""
    items: list[NotPurchasedItemResponse]
    source_list_name: Optional[str] = None
    source_list_id: Optional[str] = None


@router.get("/house/{house_id}/not-purchased", response_model=NotPurchasedRecoveryResponse)
def get_not_purchased_items(
    house_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get not purchased items from the last completed shopping list for a house.

    This is used when creating a new list to offer recovery of items that
    weren't available during the previous shopping trip.
    """
    # Find the most recent completed list for this house
    last_completed = db.query(ShoppingList).filter(
        ShoppingList.house_id == house_id,
        ShoppingList.status == ShoppingListStatus.COMPLETED
    ).order_by(ShoppingList.updated_at.desc()).first()

    if not last_completed:
        return NotPurchasedRecoveryResponse(items=[], source_list_name=None, source_list_id=None)

    # Get items that were marked as not purchased
    not_purchased_items = db.query(ShoppingListItem).filter(
        ShoppingListItem.shopping_list_id == last_completed.id,
        ShoppingListItem.not_purchased == True
    ).order_by(ShoppingListItem.position).all()

    if not not_purchased_items:
        return NotPurchasedRecoveryResponse(items=[], source_list_name=None, source_list_id=None)

    items = [
        NotPurchasedItemResponse(
            id=str(item.id),
            name=item.name,
            grocy_product_id=item.grocy_product_id,
            grocy_product_name=item.grocy_product_name,
            quantity=item.quantity,
            unit=item.unit
        )
        for item in not_purchased_items
    ]

    return NotPurchasedRecoveryResponse(
        items=items,
        source_list_name=last_completed.name,
        source_list_id=str(last_completed.id)
    )
