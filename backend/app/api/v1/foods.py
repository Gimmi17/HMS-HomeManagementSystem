"""
Foods API Endpoints
CRUD operations for the food nutritional database.
Each house has its own foods. house_id=null are global templates.

Endpoints:
    - GET /foods - Search and list foods for a house
    - GET /foods/{id} - Get single food details
    - GET /foods/categories - Get list of all categories for a house
    - GET /foods/templates - Get global template foods
    - POST /foods/import-templates - Import global templates into a house
    - POST /foods - Create a new food for a house
    - PUT /foods/{id} - Update a food
    - DELETE /foods/{id} - Delete a food
"""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.food import Food
from app.models.user_house import UserHouse
from app.schemas.food import (
    FoodResponse,
    FoodListResponse,
    CategoryResponse,
    FoodCreate,
    FoodUpdate,
)


router = APIRouter(prefix="/foods", tags=["foods"])


def verify_house_access(db: Session, user_id: UUID, house_id: UUID) -> bool:
    """Verify user has access to the house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()
    return membership is not None


@router.post("", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
def create_food(
    data: FoodCreate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new food for a house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Check if food with same name already exists in this house
    existing = db.query(Food).filter(
        Food.house_id == house_id,
        Food.name.ilike(data.name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un alimento con questo nome esiste già"
        )

    food = Food(
        house_id=house_id,
        name=data.name,
        category=data.category,
        proteins_g=data.proteins_g,
        fats_g=data.fats_g,
        carbs_g=data.carbs_g,
        fibers_g=data.fibers_g,
        omega3_ala_g=data.omega3_ala_g,
        omega6_g=data.omega6_g,
        calcium_g=data.calcium_g,
        iron_g=data.iron_g,
        magnesium_g=data.magnesium_g,
        potassium_g=data.potassium_g,
        zinc_g=data.zinc_g,
        vitamin_a_g=data.vitamin_a_g,
        vitamin_c_g=data.vitamin_c_g,
        vitamin_d_g=data.vitamin_d_g,
        vitamin_e_g=data.vitamin_e_g,
        vitamin_k_g=data.vitamin_k_g,
        vitamin_b6_g=data.vitamin_b6_g,
        folate_b9_g=data.folate_b9_g,
        vitamin_b12_g=data.vitamin_b12_g,
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return food


@router.get("", response_model=FoodListResponse)
def search_foods(
    house_id: UUID = Query(..., description="House ID"),
    search: Optional[str] = Query(
        None,
        description="Search term for food name (case-insensitive, partial match)"
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by food category (e.g., 'Carne', 'Verdura')"
    ),
    limit: int = Query(
        50,
        ge=1,
        le=200,
        description="Maximum number of results to return (1-200)"
    ),
    offset: int = Query(
        0,
        ge=0,
        description="Number of results to skip (for pagination)"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search and list foods for a house with optional filters.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Build query filtering by house_id
    query = db.query(Food).filter(Food.house_id == house_id)

    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(Food.name.ilike(search_pattern))

    # Apply category filter
    if category:
        query = query.filter(Food.category == category)

    # Get total count before pagination
    total = query.count()

    # Apply ordering and pagination
    foods = query.order_by(Food.name).limit(limit).offset(offset).all()

    return FoodListResponse(
        foods=foods,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/categories", response_model=CategoryResponse)
def get_categories(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all unique food categories for a house.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Query distinct category values for this house
    categories = (
        db.query(Food.category)
        .filter(Food.house_id == house_id)
        .filter(Food.category.isnot(None))
        .distinct()
        .order_by(Food.category)
        .all()
    )

    category_list = [cat[0] for cat in categories]
    return CategoryResponse(categories=category_list)


@router.get("/templates", response_model=FoodListResponse)
def get_template_foods(
    search: Optional[str] = Query(None, description="Search by name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get global template foods (house_id=null).
    These can be imported into a house.
    """
    query = db.query(Food).filter(Food.house_id.is_(None))

    if search:
        query = query.filter(Food.name.ilike(f"%{search}%"))

    if category:
        query = query.filter(Food.category == category)

    total = query.count()
    foods = query.order_by(Food.name).offset(offset).limit(limit).all()

    return FoodListResponse(foods=foods, total=total, limit=limit, offset=offset)


@router.get("/templates/categories", response_model=CategoryResponse)
def get_template_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all unique categories from template foods.
    """
    categories = (
        db.query(Food.category)
        .filter(Food.house_id.is_(None))
        .filter(Food.category.isnot(None))
        .distinct()
        .order_by(Food.category)
        .all()
    )

    category_list = [cat[0] for cat in categories]
    return CategoryResponse(categories=category_list)


@router.post("/import-templates", status_code=status.HTTP_201_CREATED)
def import_template_foods(
    house_id: UUID = Query(..., description="House ID to import into"),
    category: Optional[str] = Query(None, description="Import only this category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Import global template foods into a house.
    Skips foods that already exist in the house (by name, case-insensitive).
    Optionally filter by category.
    """
    # Verify house access
    if not verify_house_access(db, current_user.id, house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questa casa"
        )

    # Get template foods
    query = db.query(Food).filter(Food.house_id.is_(None))
    if category:
        query = query.filter(Food.category == category)
    templates = query.all()

    # Get existing food names in house
    existing_names = set(
        name.lower() for (name,) in db.query(Food.name).filter(
            Food.house_id == house_id
        ).all()
    )

    imported = 0
    for template in templates:
        if template.name.lower() not in existing_names:
            new_food = Food(
                house_id=house_id,
                name=template.name,
                category=template.category,
                proteins_g=template.proteins_g,
                fats_g=template.fats_g,
                carbs_g=template.carbs_g,
                fibers_g=template.fibers_g,
                omega3_ala_g=template.omega3_ala_g,
                omega6_g=template.omega6_g,
                calcium_g=template.calcium_g,
                iron_g=template.iron_g,
                magnesium_g=template.magnesium_g,
                potassium_g=template.potassium_g,
                zinc_g=template.zinc_g,
                vitamin_a_g=template.vitamin_a_g,
                vitamin_c_g=template.vitamin_c_g,
                vitamin_d_g=template.vitamin_d_g,
                vitamin_e_g=template.vitamin_e_g,
                vitamin_k_g=template.vitamin_k_g,
                vitamin_b6_g=template.vitamin_b6_g,
                folate_b9_g=template.folate_b9_g,
                vitamin_b12_g=template.vitamin_b12_g,
            )
            db.add(new_food)
            imported += 1

    db.commit()

    category_msg = f" nella categoria '{category}'" if category else ""
    return {"message": f"Importati {imported} alimenti{category_msg}", "imported": imported}


@router.get("/{food_id}", response_model=FoodResponse)
def get_food(
    food_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information for a single food.
    """
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alimento non trovato"
        )

    # Verify access if food belongs to a house
    if food.house_id and not verify_house_access(db, current_user.id, food.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo alimento"
        )

    return food


@router.put("/{food_id}", response_model=FoodResponse)
def update_food(
    food_id: UUID,
    data: FoodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a food.
    """
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alimento non trovato"
        )

    # Verify access if food belongs to a house
    if food.house_id and not verify_house_access(db, current_user.id, food.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo alimento"
        )

    # Check if new name conflicts
    if data.name is not None and data.name.lower() != food.name.lower():
        existing = db.query(Food).filter(
            Food.house_id == food.house_id,
            Food.name.ilike(data.name)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Un alimento con questo nome esiste già"
            )

    # Update fields
    for field in [
        'name', 'category', 'proteins_g', 'fats_g', 'carbs_g', 'fibers_g',
        'omega3_ala_g', 'omega6_g', 'calcium_g', 'iron_g', 'magnesium_g',
        'potassium_g', 'zinc_g', 'vitamin_a_g', 'vitamin_c_g', 'vitamin_d_g',
        'vitamin_e_g', 'vitamin_k_g', 'vitamin_b6_g', 'folate_b9_g', 'vitamin_b12_g'
    ]:
        value = getattr(data, field, None)
        if value is not None:
            setattr(food, field, value)

    db.commit()
    db.refresh(food)
    return food


@router.delete("/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food(
    food_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a food.
    User must have access to the house.
    """
    food = db.query(Food).filter(Food.id == food_id).first()

    if not food:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alimento non trovato"
        )

    # Verify access if food belongs to a house
    if food.house_id and not verify_house_access(db, current_user.id, food.house_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non hai accesso a questo alimento"
        )

    db.delete(food)
    db.commit()
