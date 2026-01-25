"""
Stores API Endpoints
CRUD operations for stores (shared across all houses).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.store import Store
from app.schemas.store import (
    StoreCreate,
    StoreUpdate,
    StoreResponse,
    StoresResponse,
)


router = APIRouter(prefix="/stores", tags=["Stores"])


@router.post("", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    data: StoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new store.
    Stores are shared across all houses.
    """
    store = Store(
        chain=data.chain,
        name=data.name,
        address=data.address,
        country=data.country,
        size=data.size,
        created_by=current_user.id
    )
    db.add(store)
    db.commit()
    db.refresh(store)
    return store


@router.get("", response_model=StoresResponse)
def get_stores(
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all stores.
    Optionally filter by search term.
    """
    query = db.query(Store)

    if search:
        query = query.filter(Store.name.ilike(f"%{search}%"))

    total = query.count()
    stores = query.order_by(Store.name).offset(offset).limit(limit).all()

    return StoresResponse(stores=stores, total=total)


@router.get("/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single store by ID.
    """
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negozio non trovato"
        )

    return store


@router.put("/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: UUID,
    data: StoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a store.
    """
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negozio non trovato"
        )

    if data.chain is not None:
        store.chain = data.chain
    if data.name is not None:
        store.name = data.name
    if data.address is not None:
        store.address = data.address
    if data.country is not None:
        store.country = data.country
    if data.size is not None:
        store.size = data.size

    db.commit()
    db.refresh(store)
    return store


@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_store(
    store_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a store.
    Only the creator can delete it.
    """
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negozio non trovato"
        )

    if store.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo il creatore può eliminare questo negozio"
        )

    db.delete(store)
    db.commit()
