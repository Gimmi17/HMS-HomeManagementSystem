"""
Stores API Endpoints
CRUD operations for stores.
Each house has its own stores. house_id=null are global templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.store import Store
from app.models.user_house import UserHouse
from app.schemas.store import (
    StoreCreate,
    StoreUpdate,
    StoreResponse,
    StoresResponse,
)


router = APIRouter(prefix="/stores", tags=["Stores"])


def verify_house_access(db: Session, user_id: UUID, house_id: UUID) -> bool:
    """Verify user has access to the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()
    return membership is not None


@router.post("", response_model=StoreResponse, status_code=status.HTTP_201_CREATED)
def create_store(
    data: StoreCreate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new store for a house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Check if store with same name and chain already exists in this house
    query = db.query(Store).filter(
        Store.house_id == house_id,
        Store.name.ilike(data.name)
    )
    if data.chain:
        query = query.filter(Store.chain.ilike(data.chain))
    else:
        query = query.filter(Store.chain.is_(None))

    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un negozio con questo nome e catena esiste già"
        )

    store = Store(
        house_id=house_id,
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
    house_id: UUID = Query(..., description="House ID"),
    search: Optional[str] = Query(None, description="Search by name or chain"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all stores for a house.
    Optionally filter by search term.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    query = db.query(Store).filter(Store.house_id == house_id)

    if search:
        query = query.filter(
            (Store.name.ilike(f"%{search}%")) |
            (Store.chain.ilike(f"%{search}%"))
        )

    total = query.count()
    stores = query.order_by(Store.chain, Store.name).offset(offset).limit(limit).all()

    return StoresResponse(stores=stores, total=total)


@router.get("/templates", response_model=StoresResponse)
def get_template_stores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global template stores (house_id=null).
    These can be imported into a house.
    """
    stores = db.query(Store).filter(
        Store.house_id.is_(None)
    ).order_by(Store.chain, Store.name).all()

    return StoresResponse(stores=stores, total=len(stores))


@router.post("/import-templates", status_code=status.HTTP_201_CREATED)
def import_template_stores(
    house_id: UUID = Query(..., description="House ID to import into"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import all global template stores into a house.
    Skips stores that already exist in the house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Get template stores
    templates = db.query(Store).filter(Store.house_id.is_(None)).all()

    # Get existing store identifiers in house (chain + name)
    existing = set()
    for store in db.query(Store).filter(Store.house_id == house_id).all():
        key = (store.chain or "").lower() + "|" + store.name.lower()
        existing.add(key)

    imported = 0
    for template in templates:
        key = (template.chain or "").lower() + "|" + template.name.lower()
        if key not in existing:
            new_store = Store(
                house_id=house_id,
                chain=template.chain,
                name=template.name,
                address=template.address,
                country=template.country,
                size=template.size,
                created_by=current_user.id
            )
            db.add(new_store)
            imported += 1

    db.commit()

    return {"message": f"Importati {imported} negozi", "imported": imported}


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

    # Verify access if store belongs to a house
    if store.house_id and not verify_house_access(db, current_user.id, store.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo negozio"
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

    # Verify access if store belongs to a house
    if store.house_id and not verify_house_access(db, current_user.id, store.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo negozio"
        )

    # Check if new name/chain conflicts with existing store in same house
    if data.name is not None or data.chain is not None:
        new_name = data.name if data.name is not None else store.name
        new_chain = data.chain if data.chain is not None else store.chain

        if new_name.lower() != store.name.lower() or (new_chain or "").lower() != (store.chain or "").lower():
            query = db.query(Store).filter(
                Store.house_id == store.house_id,
                Store.name.ilike(new_name),
                Store.id != store_id
            )
            if new_chain:
                query = query.filter(Store.chain.ilike(new_chain))
            else:
                query = query.filter(Store.chain.is_(None))

            existing = query.first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Un negozio con questo nome e catena esiste già"
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
    User must have access to the house.
    """
    store = db.query(Store).filter(Store.id == store_id).first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Negozio non trovato"
        )

    # Verify access if store belongs to a house
    if store.house_id and not verify_house_access(db, current_user.id, store.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo negozio"
        )

    db.delete(store)
    db.commit()
