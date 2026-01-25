"""
Pydantic Schemas Module
Contains request/response schemas for API validation and serialization.

Pydantic schemas are used for:
- Validating incoming request data
- Serializing database models to JSON responses
- Auto-generating OpenAPI documentation
"""

from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    LoginRequest,
    Token,
    RefreshTokenRequest,
    PasswordChangeRequest,
    TokenPayload,
)
from app.schemas.grocy import (
    GrocyProduct,
    GrocyStockItem,
    GrocyStockResponse,
)
from app.schemas.shopping_list import (
    ShoppingListStatusEnum,
    ShoppingListItemCreate,
    ShoppingListItemUpdate,
    ShoppingListItemResponse,
    ShoppingListCreate,
    ShoppingListUpdate,
    ShoppingListResponse,
    ShoppingListSummary,
    ShoppingListsResponse,
    BarcodeScanRequest,
    BarcodeScanResponse,
)

__all__ = [
    # User schemas
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "LoginRequest",
    "Token",
    "RefreshTokenRequest",
    "PasswordChangeRequest",
    "TokenPayload",
    # Grocy schemas
    "GrocyProduct",
    "GrocyStockItem",
    "GrocyStockResponse",
    # Shopping List schemas
    "ShoppingListStatusEnum",
    "ShoppingListItemCreate",
    "ShoppingListItemUpdate",
    "ShoppingListItemResponse",
    "ShoppingListCreate",
    "ShoppingListUpdate",
    "ShoppingListResponse",
    "ShoppingListSummary",
    "ShoppingListsResponse",
    "BarcodeScanRequest",
    "BarcodeScanResponse",
]

# Future schemas to add as features are implemented:
# from app.schemas.house import HouseCreate, HouseResponse, HouseInviteCreate, ...
# from app.schemas.recipe import RecipeCreate, RecipeResponse, ...
# from app.schemas.meal import MealCreate, MealResponse, ...
# from app.schemas.food import FoodResponse, ...
# from app.schemas.health import WeightCreate, HealthRecordCreate, ...
