"""
Anagrafiche API Endpoints
Administrative endpoints for managing master data.

Since this is a private home application, all users have full access.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User, UserRole
from app.models.house import House
from app.models.user_house import UserHouse
from app.models.food import Food
from app.models.product_catalog import ProductCatalog
from app.models.product_barcode import ProductBarcode
from app.models.product_category_tag import ProductCategoryTag, product_category_association
from app.models.shopping_list import ShoppingListItem
from app.models.barcode_source import BarcodeLookupSource
from app.models.product_report import ProductReport, ReportStatus
from app.services.auth_service import hash_password
from app.services.barcode_source_service import lookup_barcode_chain
from app.services.product_enrichment import parse_and_save_category_tags


router = APIRouter(prefix="/anagrafiche", tags=["Anagrafiche"])


def _get_product_by_barcode(db, barcode: str, include_cancelled: bool = False):
    """Lookup ProductCatalog via ProductBarcode table."""
    q = db.query(ProductCatalog).join(
        ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
    ).filter(ProductBarcode.barcode == barcode)
    if not include_cancelled:
        q = q.filter(ProductCatalog.cancelled == False)
    return q.first()


# ============================================================
# USER MANAGEMENT
# ============================================================

class UserListItem(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str] = None
    role: str
    has_recovery_setup: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserListItem]
    total: int


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: str = "basic"


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)


@router.get("/users", response_model=UserListResponse)
def list_users(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all users with optional search."""
    query = db.query(User)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_term),
                User.full_name.ilike(search_term)
            )
        )

    users = query.order_by(User.created_at.desc()).all()

    return UserListResponse(
        users=[
            UserListItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role.value if u.role else "basic",
                has_recovery_setup=u.has_recovery_setup or False,
                created_at=u.created_at,
                updated_at=u.updated_at
            )
            for u in users
        ],
        total=len(users)
    )


@router.post("/users", response_model=UserListItem, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new user."""
    # Check if email already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email gia registrata"
        )

    # Create user
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=UserRole.ADMIN if user_data.role == "admin" else UserRole.BASIC,
        preferences={}
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return UserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if user.role else "basic",
        has_recovery_setup=user.has_recovery_setup or False,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.put("/users/{user_id}", response_model=UserListItem)
def update_user(
    user_id: UUID,
    user_data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    if user_data.email is not None:
        # Check email not taken by another user
        existing = db.query(User).filter(
            User.email == user_data.email,
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email gia in uso")
        user.email = user_data.email

    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    if user_data.role is not None:
        user.role = UserRole.ADMIN if user_data.role == "admin" else UserRole.BASIC

    if user_data.password is not None:
        user.password_hash = hash_password(user_data.password)

    db.commit()
    db.refresh(user)

    return UserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if user.role else "basic",
        has_recovery_setup=user.has_recovery_setup or False,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a user."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Non puoi eliminare te stesso")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    db.delete(user)
    db.commit()


# ============================================================
# HOUSE MANAGEMENT
# ============================================================

class HouseListItem(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    owner_id: UUID
    owner_name: Optional[str] = None
    member_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class HouseListResponse(BaseModel):
    houses: List[HouseListItem]
    total: int


class HouseCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    owner_id: UUID


class HouseUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    owner_id: Optional[UUID] = None


@router.get("/houses", response_model=HouseListResponse)
def list_houses(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all houses."""
    query = db.query(House)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                House.name.ilike(search_term),
                House.location.ilike(search_term)
            )
        )

    houses = query.order_by(House.created_at.desc()).all()

    result = []
    for h in houses:
        owner = db.query(User).filter(User.id == h.owner_id).first()
        # Count members (simplified - would need user_house table query)
        result.append(HouseListItem(
            id=h.id,
            name=h.name,
            description=h.description,
            location=h.location,
            owner_id=h.owner_id,
            owner_name=owner.full_name if owner else None,
            member_count=0,  # TODO: count from user_house
            created_at=h.created_at
        ))

    return HouseListResponse(houses=result, total=len(result))


@router.post("/houses", response_model=HouseListItem, status_code=status.HTTP_201_CREATED)
def create_house(
    house_data: HouseCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new house."""
    # Verify owner exists
    owner = db.query(User).filter(User.id == house_data.owner_id).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Proprietario non trovato")

    house = House(
        name=house_data.name,
        description=house_data.description,
        location=house_data.location,
        owner_id=house_data.owner_id,
        settings={}
    )

    db.add(house)
    db.flush()

    # Add owner as house member
    membership = UserHouse(
        user_id=house_data.owner_id,
        house_id=house.id,
        role="OWNER"
    )
    db.add(membership)
    db.commit()
    db.refresh(house)

    return HouseListItem(
        id=house.id,
        name=house.name,
        description=house.description,
        location=house.location,
        owner_id=house.owner_id,
        owner_name=owner.full_name,
        member_count=1,
        created_at=house.created_at
    )


@router.put("/houses/{house_id}", response_model=HouseListItem)
def update_house(
    house_id: UUID,
    house_data: HouseUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a house."""
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa non trovata")

    if house_data.name is not None:
        house.name = house_data.name
    if house_data.description is not None:
        house.description = house_data.description
    if house_data.location is not None:
        house.location = house_data.location
    if house_data.owner_id is not None:
        owner = db.query(User).filter(User.id == house_data.owner_id).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Proprietario non trovato")
        house.owner_id = house_data.owner_id

    db.commit()
    db.refresh(house)

    owner = db.query(User).filter(User.id == house.owner_id).first()

    return HouseListItem(
        id=house.id,
        name=house.name,
        description=house.description,
        location=house.location,
        owner_id=house.owner_id,
        owner_name=owner.full_name if owner else None,
        member_count=0,
        created_at=house.created_at
    )


@router.delete("/houses/{house_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_house(
    house_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a house."""
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa non trovata")

    db.delete(house)
    db.commit()


# ============================================================
# FOOD MANAGEMENT
# ============================================================

class FoodListItem(BaseModel):
    id: UUID
    name: str
    category: Optional[str] = None
    proteins_g: Optional[float] = None
    fats_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fibers_g: Optional[float] = None

    class Config:
        from_attributes = True


class FoodDetailItem(BaseModel):
    """Full food detail with all nutritional values."""
    id: UUID
    name: str
    category: Optional[str] = None
    # Macronutrients
    proteins_g: Optional[float] = None
    fats_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fibers_g: Optional[float] = None
    # Essential fatty acids
    omega3_ala_g: Optional[float] = None
    omega6_g: Optional[float] = None
    # Minerals
    calcium_g: Optional[float] = None
    iron_g: Optional[float] = None
    magnesium_g: Optional[float] = None
    potassium_g: Optional[float] = None
    zinc_g: Optional[float] = None
    # Vitamins
    vitamin_a_g: Optional[float] = None
    vitamin_c_g: Optional[float] = None
    vitamin_d_g: Optional[float] = None
    vitamin_e_g: Optional[float] = None
    vitamin_k_g: Optional[float] = None
    vitamin_b6_g: Optional[float] = None
    folate_b9_g: Optional[float] = None
    vitamin_b12_g: Optional[float] = None

    class Config:
        from_attributes = True


class FoodListResponse(BaseModel):
    foods: List[FoodListItem]
    total: int


class FoodCreateRequest(BaseModel):
    name: str
    category: Optional[str] = None
    proteins_g: Optional[float] = None
    fats_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fibers_g: Optional[float] = None
    omega3_ala_g: Optional[float] = None
    omega6_g: Optional[float] = None
    calcium_g: Optional[float] = None
    iron_g: Optional[float] = None
    magnesium_g: Optional[float] = None
    potassium_g: Optional[float] = None
    zinc_g: Optional[float] = None
    vitamin_a_g: Optional[float] = None
    vitamin_c_g: Optional[float] = None
    vitamin_d_g: Optional[float] = None
    vitamin_e_g: Optional[float] = None
    vitamin_k_g: Optional[float] = None
    vitamin_b6_g: Optional[float] = None
    folate_b9_g: Optional[float] = None
    vitamin_b12_g: Optional[float] = None


class FoodUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    proteins_g: Optional[float] = None
    fats_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fibers_g: Optional[float] = None
    omega3_ala_g: Optional[float] = None
    omega6_g: Optional[float] = None
    calcium_g: Optional[float] = None
    iron_g: Optional[float] = None
    magnesium_g: Optional[float] = None
    potassium_g: Optional[float] = None
    zinc_g: Optional[float] = None
    vitamin_a_g: Optional[float] = None
    vitamin_c_g: Optional[float] = None
    vitamin_d_g: Optional[float] = None
    vitamin_e_g: Optional[float] = None
    vitamin_k_g: Optional[float] = None
    vitamin_b6_g: Optional[float] = None
    folate_b9_g: Optional[float] = None
    vitamin_b12_g: Optional[float] = None


@router.get("/foods", response_model=FoodListResponse)
def list_foods(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all foods with optional filters."""
    query = db.query(Food)

    if search:
        query = query.filter(Food.name.ilike(f"%{search}%"))

    if category:
        query = query.filter(Food.category == category)

    total = query.count()
    foods = query.order_by(Food.name).offset(offset).limit(limit).all()

    return FoodListResponse(
        foods=[
            FoodListItem(
                id=f.id,
                name=f.name,
                category=f.category,
                proteins_g=float(f.proteins_g) if f.proteins_g else None,
                fats_g=float(f.fats_g) if f.fats_g else None,
                carbs_g=float(f.carbs_g) if f.carbs_g else None,
                fibers_g=float(f.fibers_g) if f.fibers_g else None
            )
            for f in foods
        ],
        total=total
    )


def _food_to_detail(f: Food) -> FoodDetailItem:
    """Convert Food model to FoodDetailItem."""
    return FoodDetailItem(
        id=f.id,
        name=f.name,
        category=f.category,
        proteins_g=float(f.proteins_g) if f.proteins_g else None,
        fats_g=float(f.fats_g) if f.fats_g else None,
        carbs_g=float(f.carbs_g) if f.carbs_g else None,
        fibers_g=float(f.fibers_g) if f.fibers_g else None,
        omega3_ala_g=float(f.omega3_ala_g) if f.omega3_ala_g else None,
        omega6_g=float(f.omega6_g) if f.omega6_g else None,
        calcium_g=float(f.calcium_g) if f.calcium_g else None,
        iron_g=float(f.iron_g) if f.iron_g else None,
        magnesium_g=float(f.magnesium_g) if f.magnesium_g else None,
        potassium_g=float(f.potassium_g) if f.potassium_g else None,
        zinc_g=float(f.zinc_g) if f.zinc_g else None,
        vitamin_a_g=float(f.vitamin_a_g) if f.vitamin_a_g else None,
        vitamin_c_g=float(f.vitamin_c_g) if f.vitamin_c_g else None,
        vitamin_d_g=float(f.vitamin_d_g) if f.vitamin_d_g else None,
        vitamin_e_g=float(f.vitamin_e_g) if f.vitamin_e_g else None,
        vitamin_k_g=float(f.vitamin_k_g) if f.vitamin_k_g else None,
        vitamin_b6_g=float(f.vitamin_b6_g) if f.vitamin_b6_g else None,
        folate_b9_g=float(f.folate_b9_g) if f.folate_b9_g else None,
        vitamin_b12_g=float(f.vitamin_b12_g) if f.vitamin_b12_g else None,
    )


@router.get("/foods/{food_id}", response_model=FoodDetailItem)
def get_food(
    food_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single food with all nutritional details."""
    food = db.query(Food).filter(Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Alimento non trovato")
    return _food_to_detail(food)


@router.post("/foods", response_model=FoodDetailItem, status_code=status.HTTP_201_CREATED)
def create_food(
    food_data: FoodCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new food entry."""
    # Check if name already exists
    existing = db.query(Food).filter(Food.name == food_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Alimento gia esistente")

    food = Food(**food_data.model_dump())
    db.add(food)
    db.commit()
    db.refresh(food)

    return _food_to_detail(food)


@router.put("/foods/{food_id}", response_model=FoodDetailItem)
def update_food(
    food_id: UUID,
    food_data: FoodUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a food entry."""
    food = db.query(Food).filter(Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Alimento non trovato")

    update_data = food_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(food, field, value)

    db.commit()
    db.refresh(food)

    return _food_to_detail(food)


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_food(
    food_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a food entry."""
    food = db.query(Food).filter(Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Alimento non trovato")

    db.delete(food)
    db.commit()


# ============================================================
# PRODUCT CATALOG MANAGEMENT
# ============================================================

class ProductListItem(BaseModel):
    id: UUID
    barcode: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity_text: Optional[str] = None
    categories: Optional[str] = None
    # Nutritional values per 100g
    energy_kcal: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    sugars_g: Optional[float] = None
    fats_g: Optional[float] = None
    saturated_fats_g: Optional[float] = None
    fiber_g: Optional[float] = None
    salt_g: Optional[float] = None
    # Scores
    nutriscore: Optional[str] = None
    ecoscore: Optional[str] = None
    nova_group: Optional[str] = None
    # Images
    image_url: Optional[str] = None
    image_small_url: Optional[str] = None
    # House ownership
    house_id: Optional[UUID] = None
    house_name: Optional[str] = None
    # User notes
    user_notes: Optional[str] = None
    # Linked food
    food_id: Optional[UUID] = None
    food_name: Optional[str] = None
    # Composition
    composition: Optional[list] = None
    # Meta
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    products: List[ProductListItem]
    total: int


def _get_display_barcode(product: ProductCatalog) -> Optional[str]:
    """Get the display barcode: primary from product_barcodes, or first, or legacy column."""
    if product.barcodes:
        primary = next((pb for pb in product.barcodes if pb.is_primary), None)
        if primary:
            return primary.barcode
        return product.barcodes[0].barcode
    return product.barcode  # legacy fallback


def _product_to_list_item(product: ProductCatalog) -> ProductListItem:
    """Convert a ProductCatalog model to ProductListItem, including food_name from relationship."""
    item = ProductListItem.model_validate(product)
    item.barcode = _get_display_barcode(product)
    item.food_name = product.food.name if product.food else None
    return item


class ProductCreateRequest(BaseModel):
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


class ProductUpdateRequest(BaseModel):
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
    user_notes: Optional[str] = None


@router.get("/products", response_model=ProductListResponse)
def list_products(
    search: Optional[str] = Query(None),
    category_tag_id: Optional[UUID] = Query(None, description="Filter by category tag ID"),
    certified: Optional[bool] = Query(None, description="Filter by certification: true=certified, false=not certified, null=all"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all products in catalog (excluding cancelled)."""
    query = db.query(
        ProductCatalog,
        House.name.label("house_name"),
        Food.name.label("food_name"),
    ).outerjoin(
        House, ProductCatalog.house_id == House.id
    ).outerjoin(
        Food, ProductCatalog.food_id == Food.id
    ).filter(
        ProductCatalog.cancelled == False
    )

    # Filter by certification status
    if certified is True:
        query = query.filter(ProductCatalog.source != "not_found")
    elif certified is False:
        query = query.filter(ProductCatalog.source == "not_found")

    if search:
        search_term = f"%{search}%"
        barcode_subq = db.query(ProductBarcode.product_id).filter(
            ProductBarcode.barcode.ilike(search_term)
        ).subquery()
        query = query.filter(
            or_(
                ProductCatalog.name.ilike(search_term),
                ProductCatalog.brand.ilike(search_term),
                ProductCatalog.id.in_(barcode_subq)
            )
        )

    # Filter by category tag
    if category_tag_id:
        query = query.join(
            product_category_association,
            ProductCatalog.id == product_category_association.c.product_id
        ).filter(
            product_category_association.c.category_tag_id == category_tag_id
        )

    total = query.count()
    rows = query.order_by(ProductCatalog.created_at.desc()).offset(offset).limit(limit).all()

    # Batch load primary barcodes to avoid N+1 queries
    product_ids = [p.id for p, _, _ in rows]
    bc_map: dict = {}
    if product_ids:
        barcodes = db.query(ProductBarcode).filter(
            ProductBarcode.product_id.in_(product_ids)
        ).all()
        for pb in barcodes:
            pid = str(pb.product_id)
            if pid not in bc_map or pb.is_primary:
                bc_map[pid] = pb.barcode

    return ProductListResponse(
        products=[
            ProductListItem(
                id=p.id,
                barcode=bc_map.get(str(p.id), p.barcode),
                name=p.name,
                brand=p.brand,
                quantity_text=p.quantity_text,
                categories=p.categories,
                energy_kcal=p.energy_kcal,
                proteins_g=p.proteins_g,
                carbs_g=p.carbs_g,
                sugars_g=p.sugars_g,
                fats_g=p.fats_g,
                saturated_fats_g=p.saturated_fats_g,
                fiber_g=p.fiber_g,
                salt_g=p.salt_g,
                nutriscore=p.nutriscore,
                ecoscore=p.ecoscore,
                nova_group=p.nova_group,
                image_url=p.image_url,
                image_small_url=p.image_small_url,
                house_id=p.house_id,
                house_name=house_name,
                user_notes=p.user_notes,
                food_id=p.food_id,
                food_name=food_name,
                composition=p.composition,
                source=p.source,
                created_at=p.created_at
            )
            for p, house_name, food_name in rows
        ],
        total=total
    )


@router.post("/products", response_model=ProductListItem, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: ProductCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new product entry."""
    # Check if barcode already exists in product_barcodes
    if product_data.barcode:
        existing_bc = db.query(ProductBarcode).filter(
            ProductBarcode.barcode == product_data.barcode
        ).first()
        if existing_bc:
            raise HTTPException(status_code=400, detail="Barcode gia esistente")

    product = ProductCatalog(
        barcode=product_data.barcode,
        name=product_data.name,
        brand=product_data.brand,
        quantity_text=product_data.quantity_text,
        categories=product_data.categories,
        energy_kcal=product_data.energy_kcal,
        proteins_g=product_data.proteins_g,
        carbs_g=product_data.carbs_g,
        fats_g=product_data.fats_g,
        nutriscore=product_data.nutriscore,
        source="manual"
    )
    db.add(product)
    db.flush()

    # Create ProductBarcode entry if barcode provided
    if product_data.barcode:
        db.add(ProductBarcode(
            product_id=product.id,
            barcode=product_data.barcode,
            is_primary=True,
            source="manual"
        ))

    db.commit()
    db.refresh(product)

    return _product_to_list_item(product)


@router.put("/products/{product_id}", response_model=ProductListItem)
def update_product(
    product_id: UUID,
    product_data: ProductUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a product entry."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    return _product_to_list_item(product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Soft delete a product entry (set cancelled=True)."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    product.cancelled = True
    db.commit()


# ============================================================
# PRODUCT USER NOTES
# ============================================================

class UpdateProductNotesRequest(BaseModel):
    user_notes: Optional[str] = None


@router.patch("/products/{product_id}/notes", response_model=ProductListItem)
def update_product_notes(
    product_id: UUID,
    data: UpdateProductNotesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the user_notes of a product."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    product.user_notes = data.user_notes or None
    db.commit()
    db.refresh(product)

    return _product_to_list_item(product)


@router.patch("/products/by-barcode/{barcode}/notes")
def update_product_notes_by_barcode(
    barcode: str,
    data: UpdateProductNotesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user_notes of a product found by barcode. Creates a minimal catalog entry if not found."""
    # Find user's house
    membership = db.query(UserHouse).filter(UserHouse.user_id == current_user.id).first()
    house_id = membership.house_id if membership else None

    product = db.query(ProductCatalog).join(
        ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
    ).filter(
        ProductBarcode.barcode == barcode,
        ProductCatalog.cancelled == False,
        or_(
            ProductCatalog.house_id == house_id,
            ProductCatalog.house_id.is_(None)
        )
    ).first()

    if product:
        product.user_notes = data.user_notes or None
        db.commit()
        return {"success": True}

    # No catalog product with this barcode - create a minimal entry
    if house_id:
        new_product = ProductCatalog(
            house_id=house_id,
            barcode=barcode,
            source="manual",
            user_notes=data.user_notes or None,
        )
        db.add(new_product)
        db.flush()
        db.add(ProductBarcode(
            product_id=new_product.id,
            barcode=barcode,
            is_primary=True,
            source="manual"
        ))
        db.commit()
        return {"success": True}

    raise HTTPException(status_code=404, detail="Prodotto non trovato nel catalogo")


# ============================================================
# PRODUCT HOUSE ASSIGNMENT
# ============================================================

class UpdateProductHouseRequest(BaseModel):
    house_id: Optional[UUID] = None


@router.patch("/products/{product_id}/house", response_model=ProductListItem)
def update_product_house(
    product_id: UUID,
    data: UpdateProductHouseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the house_id of a product. Set to null to make it generic (visible to all)."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    if data.house_id is not None:
        house = db.query(House).filter(House.id == data.house_id).first()
        if not house:
            raise HTTPException(status_code=404, detail="Casa non trovata")

    product.house_id = data.house_id
    db.commit()
    db.refresh(product)

    house_name = None
    if product.house_id:
        house = db.query(House).filter(House.id == product.house_id).first()
        house_name = house.name if house else None

    item = _product_to_list_item(product)
    item.house_name = house_name
    return item


# ============================================================
# PRODUCT BARCODES CRUD
# ============================================================

class ProductBarcodeItem(BaseModel):
    id: UUID
    barcode: str
    is_primary: bool
    source: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AddBarcodeRequest(BaseModel):
    barcode: str
    source: Optional[str] = "manual"


@router.get("/products/{product_id}/barcodes", response_model=List[ProductBarcodeItem])
def list_product_barcodes(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all barcodes for a product."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    barcodes = db.query(ProductBarcode).filter(
        ProductBarcode.product_id == product_id
    ).order_by(ProductBarcode.is_primary.desc(), ProductBarcode.created_at).all()
    return [ProductBarcodeItem.model_validate(pb) for pb in barcodes]


@router.post("/products/{product_id}/barcodes", response_model=ProductBarcodeItem, status_code=status.HTTP_201_CREATED)
def add_product_barcode(
    product_id: UUID,
    data: AddBarcodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a barcode to a product."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    # Check if barcode already exists globally
    existing = db.query(ProductBarcode).filter(ProductBarcode.barcode == data.barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Barcode gia associato ad un altro prodotto")

    # Check if this product already has any barcodes (first one will be primary)
    existing_count = db.query(ProductBarcode).filter(
        ProductBarcode.product_id == product_id
    ).count()

    pb = ProductBarcode(
        product_id=product_id,
        barcode=data.barcode,
        is_primary=(existing_count == 0),
        source=data.source or "manual"
    )
    db.add(pb)
    db.commit()
    db.refresh(pb)
    return ProductBarcodeItem.model_validate(pb)


@router.delete("/products/{product_id}/barcodes/{barcode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_barcode(
    product_id: UUID,
    barcode_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a barcode from a product."""
    pb = db.query(ProductBarcode).filter(
        ProductBarcode.id == barcode_id,
        ProductBarcode.product_id == product_id
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Barcode non trovato")

    was_primary = pb.is_primary
    db.delete(pb)
    db.flush()

    # If deleted barcode was primary, promote another one
    if was_primary:
        next_pb = db.query(ProductBarcode).filter(
            ProductBarcode.product_id == product_id
        ).first()
        if next_pb:
            next_pb.is_primary = True

    db.commit()


@router.patch("/products/{product_id}/barcodes/{barcode_id}/set-primary", response_model=ProductBarcodeItem)
def set_barcode_primary(
    product_id: UUID,
    barcode_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Set a barcode as the primary barcode for a product."""
    pb = db.query(ProductBarcode).filter(
        ProductBarcode.id == barcode_id,
        ProductBarcode.product_id == product_id
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Barcode non trovato")

    # Unset current primary
    db.query(ProductBarcode).filter(
        ProductBarcode.product_id == product_id,
        ProductBarcode.is_primary == True
    ).update({"is_primary": False})

    pb.is_primary = True
    db.commit()
    db.refresh(pb)
    return ProductBarcodeItem.model_validate(pb)


# ============================================================
# PRODUCT NAME RECOVERY FROM SHOPPING LISTS
# ============================================================

class UnnamedProductWithDescriptions(BaseModel):
    """Product without name with possible descriptions from shopping lists."""
    id: UUID
    barcode: str
    descriptions: List[str]  # Distinct descriptions found in shopping list items


class UnnamedProductsResponse(BaseModel):
    """Response with all unnamed products and their possible descriptions."""
    products: List[UnnamedProductWithDescriptions]
    total: int


class SetProductNameRequest(BaseModel):
    """Request to set a product name."""
    name: str


@router.get("/products/unnamed-with-descriptions", response_model=UnnamedProductsResponse)
def get_unnamed_products_with_descriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all unnamed products with possible descriptions from shopping list items.

    For each product without a name (source='not_found' and name is null),
    searches for all shopping list items with the same barcode and returns
    the distinct descriptions found (grocy_product_name or name).
    """
    # Get all unnamed products that have at least one barcode
    unnamed_products = db.query(ProductCatalog).join(
        ProductBarcode, ProductCatalog.id == ProductBarcode.product_id
    ).filter(
        ProductCatalog.cancelled == False,
        ProductCatalog.source == "not_found",
        or_(ProductCatalog.name.is_(None), ProductCatalog.name == ""),
    ).distinct().all()

    result = []
    for product in unnamed_products:
        # Get all barcodes for this product from product_barcodes
        product_barcodes = db.query(ProductBarcode).filter(
            ProductBarcode.product_id == product.id
        ).all()
        barcodes_for_product = [pb.barcode for pb in product_barcodes]
        if not barcodes_for_product:
            # Fallback to legacy barcode column
            if product.barcode:
                barcodes_for_product = [product.barcode]
            else:
                continue

        # Find all shopping list items with any of this product's barcodes
        items = db.query(ShoppingListItem).filter(
            ShoppingListItem.scanned_barcode.in_(barcodes_for_product)
        ).all()

        # Use the primary barcode (or first) for display
        primary_barcode = barcodes_for_product[0]

        # Collect distinct descriptions
        descriptions_set = set()
        for item in items:
            # Prefer grocy_product_name, fallback to name
            desc = item.grocy_product_name or item.name
            if desc and not desc.startswith("Prodotto: "):
                descriptions_set.add(desc)

        descriptions = list(descriptions_set)

        # Only include products that have at least one description
        if descriptions:
            result.append(UnnamedProductWithDescriptions(
                id=product.id,
                barcode=primary_barcode,
                descriptions=descriptions
            ))

    return UnnamedProductsResponse(
        products=result,
        total=len(result)
    )


@router.put("/products/{product_id}/set-name", response_model=ProductListItem)
def set_product_name(
    product_id: UUID,
    data: SetProductNameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Set the name for a product.
    Used to assign a name to unnamed products recovered from shopping lists.
    """
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    product.name = data.name
    db.commit()
    db.refresh(product)

    return _product_to_list_item(product)


class RefetchRequest(BaseModel):
    barcode: Optional[str] = None


@router.post("/products/{product_id}/refetch", response_model=ProductListItem)
async def refetch_product_from_api(
    product_id: UUID,
    body: RefetchRequest = RefetchRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Re-fetch product data from web APIs (barcode lookup chain with fallback).
    Updates the existing ProductCatalog entry with fresh data from the sources.
    Accepts an optional barcode in the body to use instead of the DB barcode.
    """
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    # Use barcode from request body if provided, otherwise from product_barcodes or legacy column
    legacy_barcode = product.barcode
    if not legacy_barcode:
        primary_pb = db.query(ProductBarcode).filter(
            ProductBarcode.product_id == product.id,
            ProductBarcode.is_primary == True
        ).first() or db.query(ProductBarcode).filter(
            ProductBarcode.product_id == product.id
        ).first()
        if primary_pb:
            legacy_barcode = primary_pb.barcode
    lookup_barcode = (body.barcode.strip() if body.barcode else None) or (legacy_barcode.strip() if legacy_barcode else None)
    if not lookup_barcode:
        raise HTTPException(status_code=400, detail="Prodotto senza barcode, impossibile cercare nelle API")

    # Update product barcode if a new one was provided
    if body.barcode and body.barcode.strip() and body.barcode.strip() != legacy_barcode:
        new_bc = body.barcode.strip()
        product.barcode = new_bc
        # Also add to product_barcodes if not already there
        existing_pb = db.query(ProductBarcode).filter(ProductBarcode.barcode == new_bc).first()
        if not existing_pb:
            db.add(ProductBarcode(
                product_id=product.id,
                barcode=new_bc,
                is_primary=True,
                source="manual"
            ))

    # Call the barcode lookup chain (same used during verification)
    result = await lookup_barcode_chain(db, lookup_barcode)

    if not result.get("found"):
        raise HTTPException(status_code=404, detail="Prodotto non trovato in nessuna sorgente API")

    # Update product with fetched data
    product.name = result.get("product_name") or product.name
    product.brand = result.get("brand") or product.brand
    product.quantity_text = result.get("quantity") or product.quantity_text
    product.categories = result.get("categories") or product.categories
    # Score fields are varchar(1) — only store single-char values (e.g. "a", "b", "4")
    _nutriscore = result.get("nutriscore")
    _ecoscore = result.get("ecoscore")
    _nova_group = result.get("nova_group")
    product.nutriscore = _nutriscore if _nutriscore and len(_nutriscore) == 1 else product.nutriscore
    product.ecoscore = _ecoscore if _ecoscore and len(_ecoscore) == 1 else product.ecoscore
    product.nova_group = _nova_group if _nova_group and len(_nova_group) == 1 else product.nova_group
    product.image_url = result.get("image_url") or product.image_url
    product.image_small_url = result.get("image_small_url") or product.image_small_url
    product.source = result.get("source_code", product.source)
    product.raw_data = result

    # Update nutritional data
    nutrients = result.get("nutrients", {})
    if nutrients:
        product.energy_kcal = nutrients.get("energy-kcal_100g") or product.energy_kcal
        product.proteins_g = nutrients.get("proteins_100g") or product.proteins_g
        product.carbs_g = nutrients.get("carbohydrates_100g") or product.carbs_g
        product.sugars_g = nutrients.get("sugars_100g") or product.sugars_g
        product.fats_g = nutrients.get("fat_100g") or product.fats_g
        product.saturated_fats_g = nutrients.get("saturated-fat_100g") or product.saturated_fats_g
        product.fiber_g = nutrients.get("fiber_100g") or product.fiber_g
        product.salt_g = nutrients.get("salt_100g") or product.salt_g

    db.commit()
    db.refresh(product)

    # Update category tags
    categories_tags = result.get("categories_tags")
    categories_str = result.get("categories")
    parse_and_save_category_tags(db, product, categories_str, categories_tags)

    return _product_to_list_item(product)


# ============================================================
# PRODUCT CATEGORY TAGS
# ============================================================

class ProductCategoryTagItem(BaseModel):
    id: UUID
    tag_id: str
    name: Optional[str] = None
    lang: Optional[str] = None
    product_count: int = 0
    default_environment_id: Optional[UUID] = None
    default_environment_name: Optional[str] = None

    class Config:
        from_attributes = True


class ProductCategoryTagListResponse(BaseModel):
    categories: List[ProductCategoryTagItem]
    total: int


@router.get("/product-categories", response_model=ProductCategoryTagListResponse)
def list_product_categories(
    search: Optional[str] = Query(None),
    lang: Optional[str] = Query(None, description="Filter by language (e.g., 'en', 'it')"),
    min_products: int = Query(0, ge=0, description="Minimum number of products"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all product category tags with product count.
    Categories are from OpenFoodFacts taxonomy.
    """
    from sqlalchemy import func
    from app.models.environment import Environment

    # Base query with product count and environment name
    query = db.query(
        ProductCategoryTag,
        func.count(product_category_association.c.product_id).label('product_count'),
        Environment.name.label('env_name')
    ).outerjoin(
        product_category_association,
        ProductCategoryTag.id == product_category_association.c.category_tag_id
    ).outerjoin(
        Environment,
        ProductCategoryTag.default_environment_id == Environment.id
    ).group_by(ProductCategoryTag.id, Environment.name)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ProductCategoryTag.tag_id.ilike(search_term),
                ProductCategoryTag.name.ilike(search_term)
            )
        )

    # Language filter
    if lang:
        query = query.filter(ProductCategoryTag.lang == lang)

    # Minimum products filter
    if min_products > 0:
        query = query.having(func.count(product_category_association.c.product_id) >= min_products)

    # Get total before pagination
    total = query.count()

    # Order by product count descending, then by name
    results = query.order_by(
        func.count(product_category_association.c.product_id).desc(),
        ProductCategoryTag.name
    ).offset(offset).limit(limit).all()

    return ProductCategoryTagListResponse(
        categories=[
            ProductCategoryTagItem(
                id=cat.id,
                tag_id=cat.tag_id,
                name=cat.name,
                lang=cat.lang,
                product_count=count,
                default_environment_id=cat.default_environment_id,
                default_environment_name=env_name
            )
            for cat, count, env_name in results
        ],
        total=total
    )


@router.get("/product-categories/{category_id}", response_model=ProductCategoryTagItem)
def get_product_category(
    category_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single product category tag by ID."""
    from sqlalchemy import func
    from app.models.environment import Environment

    result = db.query(
        ProductCategoryTag,
        func.count(product_category_association.c.product_id).label('product_count'),
        Environment.name.label('env_name')
    ).outerjoin(
        product_category_association,
        ProductCategoryTag.id == product_category_association.c.category_tag_id
    ).outerjoin(
        Environment,
        ProductCategoryTag.default_environment_id == Environment.id
    ).filter(
        ProductCategoryTag.id == category_id
    ).group_by(ProductCategoryTag.id, Environment.name).first()

    if not result:
        raise HTTPException(status_code=404, detail="Categoria non trovata")

    cat, count, env_name = result
    return ProductCategoryTagItem(
        id=cat.id,
        tag_id=cat.tag_id,
        name=cat.name,
        lang=cat.lang,
        product_count=count,
        default_environment_id=cat.default_environment_id,
        default_environment_name=env_name
    )


# ============================================================
# PRODUCT CATEGORY DEFAULT ENVIRONMENT
# ============================================================

class UpdateCategoryDefaultEnvironmentRequest(BaseModel):
    environment_id: Optional[UUID] = None


@router.patch("/product-categories/{category_id}/default-environment", response_model=ProductCategoryTagItem)
def update_category_default_environment(
    category_id: UUID,
    data: UpdateCategoryDefaultEnvironmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the default environment for a product category tag."""
    from sqlalchemy import func
    from app.models.environment import Environment

    cat = db.query(ProductCategoryTag).filter(ProductCategoryTag.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")

    if data.environment_id is not None:
        env = db.query(Environment).filter(Environment.id == data.environment_id).first()
        if not env:
            raise HTTPException(status_code=404, detail="Ambiente non trovato")

    cat.default_environment_id = data.environment_id
    db.commit()
    db.refresh(cat)

    # Return full item with product count and env name
    result = db.query(
        ProductCategoryTag,
        func.count(product_category_association.c.product_id).label('product_count'),
        Environment.name.label('env_name')
    ).outerjoin(
        product_category_association,
        ProductCategoryTag.id == product_category_association.c.category_tag_id
    ).outerjoin(
        Environment,
        ProductCategoryTag.default_environment_id == Environment.id
    ).filter(
        ProductCategoryTag.id == category_id
    ).group_by(ProductCategoryTag.id, Environment.name).first()

    cat, count, env_name = result
    return ProductCategoryTagItem(
        id=cat.id,
        tag_id=cat.tag_id,
        name=cat.name,
        lang=cat.lang,
        product_count=count,
        default_environment_id=cat.default_environment_id,
        default_environment_name=env_name
    )


# ============================================================
# BARCODE LOOKUP SOURCES
# ============================================================

class BarcodeLookupSourceItem(BaseModel):
    id: UUID
    name: str
    code: str
    base_url: str
    api_path: str
    is_hardcoded: bool
    sort_order: int
    cancelled: bool
    description: Optional[str] = None

    class Config:
        from_attributes = True


class BarcodeLookupSourceCreate(BaseModel):
    name: str
    code: str
    base_url: str
    api_path: str = "/api/v2/product/{barcode}"
    sort_order: int
    description: Optional[str] = None


class BarcodeLookupSourceUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_path: Optional[str] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None


class BarcodeLookupSourceReorder(BaseModel):
    source_ids: List[UUID]


class BarcodeLookupSourceListResponse(BaseModel):
    sources: List[BarcodeLookupSourceItem]
    total: int


@router.get("/barcode-sources", response_model=BarcodeLookupSourceListResponse)
def list_barcode_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all barcode lookup sources ordered by sort_order (includes cancelled)."""
    sources = db.query(BarcodeLookupSource).order_by(BarcodeLookupSource.sort_order).all()

    return BarcodeLookupSourceListResponse(
        sources=[
            BarcodeLookupSourceItem(
                id=s.id,
                name=s.name,
                code=s.code,
                base_url=s.base_url,
                api_path=s.api_path,
                is_hardcoded=s.is_hardcoded,
                sort_order=s.sort_order,
                cancelled=s.cancelled,
                description=s.description,
            )
            for s in sources
        ],
        total=len(sources)
    )


@router.post("/barcode-sources", response_model=BarcodeLookupSourceItem, status_code=status.HTTP_201_CREATED)
def create_barcode_source(
    data: BarcodeLookupSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new barcode lookup source."""
    existing = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Codice sorgente gia esistente")

    source = BarcodeLookupSource(
        name=data.name,
        code=data.code,
        base_url=data.base_url,
        api_path=data.api_path,
        sort_order=data.sort_order,
        description=data.description,
        is_hardcoded=False,
        cancelled=False,
    )
    db.add(source)
    db.commit()
    db.refresh(source)

    return BarcodeLookupSourceItem(
        id=source.id,
        name=source.name,
        code=source.code,
        base_url=source.base_url,
        api_path=source.api_path,
        is_hardcoded=source.is_hardcoded,
        sort_order=source.sort_order,
        cancelled=source.cancelled,
        description=source.description,
    )


# NOTE: reorder must be defined BEFORE {source_id} routes to avoid path conflict
@router.put("/barcode-sources/reorder")
def reorder_barcode_sources(
    data: BarcodeLookupSourceReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reorder barcode lookup sources. Receives list of IDs in desired order."""
    for idx, source_id in enumerate(data.source_ids):
        source = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.id == source_id).first()
        if source:
            source.sort_order = idx + 1

    db.commit()

    return {"message": "Ordine aggiornato"}


@router.put("/barcode-sources/{source_id}", response_model=BarcodeLookupSourceItem)
def update_barcode_source(
    source_id: UUID,
    data: BarcodeLookupSourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a barcode lookup source."""
    source = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sorgente non trovata")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)

    db.commit()
    db.refresh(source)

    return BarcodeLookupSourceItem(
        id=source.id,
        name=source.name,
        code=source.code,
        base_url=source.base_url,
        api_path=source.api_path,
        is_hardcoded=source.is_hardcoded,
        sort_order=source.sort_order,
        cancelled=source.cancelled,
        description=source.description,
    )


@router.put("/barcode-sources/{source_id}/cancel", response_model=BarcodeLookupSourceItem)
def cancel_barcode_source(
    source_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel (soft-delete) a barcode lookup source."""
    source = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sorgente non trovata")

    source.cancelled = True
    db.commit()
    db.refresh(source)

    return BarcodeLookupSourceItem(
        id=source.id,
        name=source.name,
        code=source.code,
        base_url=source.base_url,
        api_path=source.api_path,
        is_hardcoded=source.is_hardcoded,
        sort_order=source.sort_order,
        cancelled=source.cancelled,
        description=source.description,
    )


@router.put("/barcode-sources/{source_id}/restore", response_model=BarcodeLookupSourceItem)
def restore_barcode_source(
    source_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a cancelled barcode lookup source."""
    source = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sorgente non trovata")

    source.cancelled = False
    db.commit()
    db.refresh(source)

    return BarcodeLookupSourceItem(
        id=source.id,
        name=source.name,
        code=source.code,
        base_url=source.base_url,
        api_path=source.api_path,
        is_hardcoded=source.is_hardcoded,
        sort_order=source.sort_order,
        cancelled=source.cancelled,
        description=source.description,
    )


@router.delete("/barcode-sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_barcode_source(
    source_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a barcode lookup source (only non-hardcoded)."""
    source = db.query(BarcodeLookupSource).filter(BarcodeLookupSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Sorgente non trovata")

    if source.is_hardcoded:
        raise HTTPException(status_code=400, detail="Non puoi eliminare una sorgente predefinita. Puoi solo annullarla.")

    db.delete(source)
    db.commit()


# ============================================================
# DATA MIGRATION - Link orphan data to a house
# ============================================================

class OrphanDataStats(BaseModel):
    categories: int = 0
    stores: int = 0
    foods: int = 0
    products: int = 0
    total: int = 0


class MigrationResult(BaseModel):
    categories_linked: int = 0
    stores_linked: int = 0
    foods_linked: int = 0
    products_linked: int = 0
    total_linked: int = 0
    house_name: str


@router.get("/migration/orphan-stats", response_model=OrphanDataStats)
def get_orphan_data_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get count of data without house_id (orphan data).
    This data needs to be linked to a house.
    """
    from app.models.category import Category
    from app.models.store import Store

    categories = db.query(Category).filter(Category.house_id.is_(None)).count()
    stores = db.query(Store).filter(Store.house_id.is_(None)).count()
    foods = db.query(Food).filter(Food.house_id.is_(None)).count()
    products = db.query(ProductCatalog).filter(ProductCatalog.house_id.is_(None)).count()

    return OrphanDataStats(
        categories=categories,
        stores=stores,
        foods=foods,
        products=products,
        total=categories + stores + foods + products
    )


@router.post("/migration/link-to-house/{house_id}", response_model=MigrationResult)
def link_orphan_data_to_house(
    house_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Link all orphan data (house_id=null) to a specific house.
    This is a one-time migration for production deployment.
    """
    from app.models.category import Category
    from app.models.store import Store

    # Verify house exists
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Casa non trovata")

    # Link categories
    categories_count = db.query(Category).filter(Category.house_id.is_(None)).update(
        {"house_id": house_id},
        synchronize_session=False
    )

    # Link stores
    stores_count = db.query(Store).filter(Store.house_id.is_(None)).update(
        {"house_id": house_id},
        synchronize_session=False
    )

    # Link foods
    foods_count = db.query(Food).filter(Food.house_id.is_(None)).update(
        {"house_id": house_id},
        synchronize_session=False
    )

    # Link products
    products_count = db.query(ProductCatalog).filter(ProductCatalog.house_id.is_(None)).update(
        {"house_id": house_id},
        synchronize_session=False
    )

    db.commit()

    return MigrationResult(
        categories_linked=categories_count,
        stores_linked=stores_count,
        foods_linked=foods_count,
        products_linked=products_count,
        total_linked=categories_count + stores_count + foods_count + products_count,
        house_name=house.name
    )


# ============================================================
# PRODUCT REPORTS
# ============================================================

class ProductReportItem(BaseModel):
    id: UUID
    product_id: UUID
    product_name: Optional[str] = None
    product_barcode: str = ""
    product_brand: Optional[str] = None
    reporter_name: Optional[str] = None
    status: str
    reason: Optional[str] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductReportListResponse(BaseModel):
    reports: List[ProductReportItem]
    total: int


class CreateReportRequest(BaseModel):
    reason: Optional[str] = None


class ResolveReportRequest(BaseModel):
    resolution_notes: Optional[str] = None


@router.post("/products/{product_id}/report", status_code=status.HTTP_201_CREATED)
def report_product(
    product_id: UUID,
    data: CreateReportRequest = CreateReportRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Report a product with incorrect data."""
    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    existing = db.query(ProductReport).filter(
        ProductReport.product_id == product_id,
        ProductReport.reporter_id == current_user.id,
        ProductReport.status == ReportStatus.OPEN
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Hai gia segnalato questo prodotto")

    report = ProductReport(
        product_id=product_id,
        reporter_id=current_user.id,
        status=ReportStatus.OPEN,
        reason=data.reason
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "id": report.id,
        "product_id": report.product_id,
        "status": report.status.value,
        "created_at": report.created_at
    }


@router.get("/product-reports", response_model=ProductReportListResponse)
def list_product_reports(
    report_status: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all product reports, optionally filtered by status."""
    from sqlalchemy import func as sa_func

    query = db.query(ProductReport)

    if report_status:
        try:
            status_enum = ReportStatus(report_status)
            query = query.filter(ProductReport.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail="Stato non valido")

    total = query.count()
    reports = query.order_by(ProductReport.created_at.desc()).all()

    result = []
    for r in reports:
        product = db.query(ProductCatalog).filter(ProductCatalog.id == r.product_id).first()
        reporter = db.query(User).filter(User.id == r.reporter_id).first() if r.reporter_id else None
        result.append(ProductReportItem(
            id=r.id,
            product_id=r.product_id,
            product_name=product.name if product else None,
            product_barcode=(product.barcode or "") if product else "",
            product_brand=product.brand if product else None,
            reporter_name=reporter.full_name if reporter else None,
            status=r.status.value,
            reason=r.reason,
            resolution_notes=r.resolution_notes,
            created_at=r.created_at,
            resolved_at=r.resolved_at
        ))

    return ProductReportListResponse(reports=result, total=total)


@router.put("/product-reports/{report_id}/resolve", response_model=ProductReportItem)
def resolve_report(
    report_id: UUID,
    data: ResolveReportRequest = ResolveReportRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resolve a product report."""
    from datetime import timezone

    report = db.query(ProductReport).filter(ProductReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Segnalazione non trovata")

    report.status = ReportStatus.RESOLVED
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = current_user.id
    report.resolution_notes = data.resolution_notes

    db.commit()
    db.refresh(report)

    product = db.query(ProductCatalog).filter(ProductCatalog.id == report.product_id).first()
    reporter = db.query(User).filter(User.id == report.reporter_id).first() if report.reporter_id else None

    return ProductReportItem(
        id=report.id,
        product_id=report.product_id,
        product_name=product.name if product else None,
        product_barcode=product.barcode if product else "",
        product_brand=product.brand if product else None,
        reporter_name=reporter.full_name if reporter else None,
        status=report.status.value,
        reason=report.reason,
        resolution_notes=report.resolution_notes,
        created_at=report.created_at,
        resolved_at=report.resolved_at
    )


@router.put("/product-reports/{report_id}/dismiss", response_model=ProductReportItem)
def dismiss_report(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dismiss a product report."""
    from datetime import timezone

    report = db.query(ProductReport).filter(ProductReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Segnalazione non trovata")

    report.status = ReportStatus.DISMISSED
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = current_user.id

    db.commit()
    db.refresh(report)

    product = db.query(ProductCatalog).filter(ProductCatalog.id == report.product_id).first()
    reporter = db.query(User).filter(User.id == report.reporter_id).first() if report.reporter_id else None

    return ProductReportItem(
        id=report.id,
        product_id=report.product_id,
        product_name=product.name if product else None,
        product_barcode=product.barcode if product else "",
        product_brand=product.brand if product else None,
        reporter_name=reporter.full_name if reporter else None,
        status=report.status.value,
        reason=report.reason,
        resolution_notes=report.resolution_notes,
        created_at=report.created_at,
        resolved_at=report.resolved_at
    )


# ============================================================
# PRODUCT COMPOSITION
# ============================================================

class CompositionItem(BaseModel):
    food_id: UUID
    food_name: str
    percentage: float  # 0-100, grams per 100g of product


class SaveCompositionRequest(BaseModel):
    items: List[CompositionItem]


class CompositionResponse(BaseModel):
    items: List[CompositionItem]
    total_percentage: float
    calculated_nutrition: Optional[dict] = None


@router.get("/products/{product_id}/composition", response_model=CompositionResponse)
def get_product_composition(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the composition of a product with calculated nutrition."""
    from app.services.nutrition import calculate_nutrition_from_percentages

    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    composition = product.composition or []
    items = [CompositionItem(**item) for item in composition]
    total_pct = sum(item.percentage for item in items)

    calculated_nutrition = None
    if composition:
        calculated_nutrition = calculate_nutrition_from_percentages(
            [{"food_id": str(item.food_id), "percentage": item.percentage} for item in items],
            db
        )

    return CompositionResponse(
        items=items,
        total_percentage=round(total_pct, 2),
        calculated_nutrition=calculated_nutrition
    )


@router.put("/products/{product_id}/composition", response_model=CompositionResponse)
def save_product_composition(
    product_id: UUID,
    data: SaveCompositionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Save the composition of a product and update linked Food nutritional values.

    If the product has no linked Food, a new one is created automatically.
    """
    from app.services.nutrition import calculate_nutrition_from_percentages

    product = db.query(ProductCatalog).filter(ProductCatalog.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")

    # Validate all food_ids exist
    for item in data.items:
        food = db.query(Food).filter(Food.id == item.food_id).first()
        if not food:
            raise HTTPException(
                status_code=400,
                detail=f"Alimento non trovato: {item.food_name} ({item.food_id})"
            )

    # Validate percentages
    for item in data.items:
        if item.percentage <= 0:
            raise HTTPException(status_code=400, detail=f"Percentuale deve essere > 0 per {item.food_name}")

    total_pct = sum(item.percentage for item in data.items)
    if total_pct > 100:
        raise HTTPException(status_code=400, detail=f"Totale percentuali ({total_pct}%) supera 100%")

    # Save composition JSONB
    composition_json = [item.model_dump(mode="json") for item in data.items]
    product.composition = composition_json

    # Calculate combined nutrition
    calculated_nutrition = calculate_nutrition_from_percentages(
        [{"food_id": str(item.food_id), "percentage": item.percentage} for item in data.items],
        db
    )

    # Update or create linked Food
    if product.food_id:
        linked_food = db.query(Food).filter(Food.id == product.food_id).first()
        if linked_food:
            for field, value in calculated_nutrition.items():
                if hasattr(linked_food, field):
                    setattr(linked_food, field, value)
    else:
        # Create a new Food and link it
        new_food = Food(
            name=product.name or f"Prodotto {_get_display_barcode(product) or product.id}",
            house_id=product.house_id,
            **{k: v for k, v in calculated_nutrition.items()}
        )
        db.add(new_food)
        db.flush()
        product.food_id = new_food.id

    db.commit()
    db.refresh(product)

    return CompositionResponse(
        items=data.items,
        total_percentage=round(total_pct, 2),
        calculated_nutrition=calculated_nutrition
    )
