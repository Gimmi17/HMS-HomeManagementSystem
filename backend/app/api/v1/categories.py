"""
Categories API Endpoints
CRUD operations for product categories (shared across all houses).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.category import Category
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoriesResponse,
)


router = APIRouter(prefix="/categories", tags=["Categories"])


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new category.
    Categories are shared across all houses.
    """
    # Check if category with same name already exists
    existing = db.query(Category).filter(Category.name.ilike(data.name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una categoria con questo nome esiste già"
        )

    category = Category(
        name=data.name,
        description=data.description,
        icon=data.icon,
        color=data.color,
        sort_order=data.sort_order,
        created_by=current_user.id
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("", response_model=CategoriesResponse)
def get_categories(
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all categories.
    Optionally filter by search term.
    """
    query = db.query(Category)

    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))

    total = query.count()
    categories = query.order_by(Category.sort_order, Category.name).offset(offset).limit(limit).all()

    return CategoriesResponse(categories=categories, total=total)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single category by ID.
    """
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria non trovata"
        )

    return category


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a category.
    """
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria non trovata"
        )

    # Check if new name conflicts with existing category
    if data.name is not None and data.name.lower() != category.name.lower():
        existing = db.query(Category).filter(Category.name.ilike(data.name)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Una categoria con questo nome esiste già"
            )

    if data.name is not None:
        category.name = data.name
    if data.description is not None:
        category.description = data.description
    if data.icon is not None:
        category.icon = data.icon
    if data.color is not None:
        category.color = data.color
    if data.sort_order is not None:
        category.sort_order = data.sort_order

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a category.
    Only the creator can delete it.
    """
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria non trovata"
        )

    if category.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo il creatore può eliminare questa categoria"
        )

    db.delete(category)
    db.commit()
