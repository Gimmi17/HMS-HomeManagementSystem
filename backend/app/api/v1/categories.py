"""
Categories API Endpoints
CRUD operations for product categories.
Each house has its own categories. house_id=null are global templates.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.category import Category
from app.models.user_house import UserHouse
from app.schemas.category import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    CategoriesResponse,
)


router = APIRouter(prefix="/categories", tags=["Categories"])


def verify_house_access(db: Session, user_id: UUID, house_id: UUID) -> bool:
    """Verify user has access to the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()
    return membership is not None


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new category for a house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Check if category with same name already exists in this house
    existing = db.query(Category).filter(
        Category.house_id == house_id,
        Category.name.ilike(data.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Una categoria con questo nome esiste già"
        )

    category = Category(
        house_id=house_id,
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
    house_id: UUID = Query(..., description="House ID"),
    search: Optional[str] = Query(None, description="Search by name"),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all categories for a house.
    Optionally filter by search term.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    query = db.query(Category).filter(Category.house_id == house_id)

    if search:
        query = query.filter(Category.name.ilike(f"%{search}%"))

    total = query.count()
    categories = query.order_by(Category.sort_order, Category.name).offset(offset).limit(limit).all()

    return CategoriesResponse(categories=categories, total=total)


@router.get("/templates", response_model=CategoriesResponse)
def get_template_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global template categories (house_id=null).
    These can be imported into a house.
    """
    categories = db.query(Category).filter(
        Category.house_id.is_(None)
    ).order_by(Category.sort_order, Category.name).all()

    return CategoriesResponse(categories=categories, total=len(categories))


@router.post("/import-templates", status_code=status.HTTP_201_CREATED)
def import_template_categories(
    house_id: UUID = Query(..., description="House ID to import into"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import all global template categories into a house.
    Skips categories that already exist in the house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Get template categories
    templates = db.query(Category).filter(Category.house_id.is_(None)).all()

    # Get existing category names in house
    existing_names = set(
        name.lower() for (name,) in db.query(Category.name).filter(
            Category.house_id == house_id
        ).all()
    )

    imported = 0
    for template in templates:
        if template.name.lower() not in existing_names:
            new_category = Category(
                house_id=house_id,
                name=template.name,
                description=template.description,
                icon=template.icon,
                color=template.color,
                sort_order=template.sort_order,
                created_by=current_user.id
            )
            db.add(new_category)
            imported += 1

    db.commit()

    return {"message": f"Importate {imported} categorie", "imported": imported}


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

    # Verify access if category belongs to a house
    if category.house_id and not verify_house_access(db, current_user.id, category.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa categoria"
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

    # Verify access if category belongs to a house
    if category.house_id and not verify_house_access(db, current_user.id, category.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa categoria"
        )

    # Check if new name conflicts with existing category in same house
    if data.name is not None and data.name.lower() != category.name.lower():
        existing = db.query(Category).filter(
            Category.house_id == category.house_id,
            Category.name.ilike(data.name)
        ).first()
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
    User must have access to the house.
    """
    category = db.query(Category).filter(Category.id == category_id).first()

    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria non trovata"
        )

    # Verify access if category belongs to a house
    if category.house_id and not verify_house_access(db, current_user.id, category.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa categoria"
        )

    db.delete(category)
    db.commit()
