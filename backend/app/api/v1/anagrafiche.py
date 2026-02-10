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
from app.models.food import Food
from app.models.product_catalog import ProductCatalog
from app.models.product_category_tag import ProductCategoryTag, product_category_association
from app.models.shopping_list import ShoppingListItem
from app.models.barcode_source import BarcodeLookupSource
from app.services.auth_service import hash_password


router = APIRouter(prefix="/anagrafiche", tags=["Anagrafiche"])


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
    db.commit()
    db.refresh(house)

    return HouseListItem(
        id=house.id,
        name=house.name,
        description=house.description,
        location=house.location,
        owner_id=house.owner_id,
        owner_name=owner.full_name,
        member_count=0,
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
    barcode: str
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
    # Meta
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    products: List[ProductListItem]
    total: int


class ProductCreateRequest(BaseModel):
    barcode: str
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
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity_text: Optional[str] = None
    categories: Optional[str] = None
    energy_kcal: Optional[float] = None
    proteins_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fats_g: Optional[float] = None
    nutriscore: Optional[str] = None


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
    """List all products in catalog (excluding cancelled and empty barcodes)."""
    query = db.query(ProductCatalog).filter(
        ProductCatalog.cancelled == False,
        ProductCatalog.barcode != '',
    )

    # Filter by certification status
    if certified is True:
        query = query.filter(ProductCatalog.source != "not_found")
    elif certified is False:
        query = query.filter(ProductCatalog.source == "not_found")

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                ProductCatalog.name.ilike(search_term),
                ProductCatalog.brand.ilike(search_term),
                ProductCatalog.barcode.ilike(search_term)
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
    products = query.order_by(ProductCatalog.created_at.desc()).offset(offset).limit(limit).all()

    return ProductListResponse(
        products=[
            ProductListItem(
                id=p.id,
                barcode=p.barcode,
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
                source=p.source,
                created_at=p.created_at
            )
            for p in products
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
    # Check if barcode already exists
    existing = db.query(ProductCatalog).filter(ProductCatalog.barcode == product_data.barcode).first()
    if existing:
        raise HTTPException(status_code=400, detail="Barcode gia esistente")

    product = ProductCatalog(
        **product_data.model_dump(),
        source="manual"
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    return ProductListItem(
        id=product.id,
        barcode=product.barcode,
        name=product.name,
        brand=product.brand,
        quantity_text=product.quantity_text,
        energy_kcal=product.energy_kcal,
        nutriscore=product.nutriscore,
        source=product.source,
        created_at=product.created_at
    )


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

    return ProductListItem(
        id=product.id,
        barcode=product.barcode,
        name=product.name,
        brand=product.brand,
        quantity_text=product.quantity_text,
        energy_kcal=product.energy_kcal,
        nutriscore=product.nutriscore,
        source=product.source,
        created_at=product.created_at
    )


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
    # Get all unnamed products (exclude empty barcodes)
    unnamed_products = db.query(ProductCatalog).filter(
        ProductCatalog.cancelled == False,
        ProductCatalog.source == "not_found",
        or_(ProductCatalog.name.is_(None), ProductCatalog.name == ""),
        ProductCatalog.barcode != '',
    ).all()

    result = []
    for product in unnamed_products:
        # Find all shopping list items with this barcode
        items = db.query(ShoppingListItem).filter(
            ShoppingListItem.scanned_barcode == product.barcode
        ).all()

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
                barcode=product.barcode,
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

    return ProductListItem(
        id=product.id,
        barcode=product.barcode,
        name=product.name,
        brand=product.brand,
        quantity_text=product.quantity_text,
        categories=product.categories,
        energy_kcal=product.energy_kcal,
        proteins_g=product.proteins_g,
        carbs_g=product.carbs_g,
        sugars_g=product.sugars_g,
        fats_g=product.fats_g,
        saturated_fats_g=product.saturated_fats_g,
        fiber_g=product.fiber_g,
        salt_g=product.salt_g,
        nutriscore=product.nutriscore,
        ecoscore=product.ecoscore,
        nova_group=product.nova_group,
        source=product.source,
        created_at=product.created_at
    )


# ============================================================
# PRODUCT CATEGORY TAGS
# ============================================================

class ProductCategoryTagItem(BaseModel):
    id: UUID
    tag_id: str
    name: Optional[str] = None
    lang: Optional[str] = None
    product_count: int = 0

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

    # Base query with product count
    query = db.query(
        ProductCategoryTag,
        func.count(product_category_association.c.product_id).label('product_count')
    ).outerjoin(
        product_category_association,
        ProductCategoryTag.id == product_category_association.c.category_tag_id
    ).group_by(ProductCategoryTag.id)

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
                product_count=count
            )
            for cat, count in results
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

    result = db.query(
        ProductCategoryTag,
        func.count(product_category_association.c.product_id).label('product_count')
    ).outerjoin(
        product_category_association,
        ProductCategoryTag.id == product_category_association.c.category_tag_id
    ).filter(
        ProductCategoryTag.id == category_id
    ).group_by(ProductCategoryTag.id).first()

    if not result:
        raise HTTPException(status_code=404, detail="Categoria non trovata")

    cat, count = result
    return ProductCategoryTagItem(
        id=cat.id,
        tag_id=cat.tag_id,
        name=cat.name,
        lang=cat.lang,
        product_count=count
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
