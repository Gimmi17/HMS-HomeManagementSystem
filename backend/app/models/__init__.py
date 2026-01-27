"""
Database Models Module
Contains SQLAlchemy ORM models for all database tables.

This module serves as the central import point for all models.
Import Base from here to access all registered models.

All models must be imported here to be registered with SQLAlchemy
and created during Base.metadata.create_all().
"""

from app.db.base import Base
from app.models.base import BaseModel
from app.models.user import User, UserRole
from app.models.food import Food
from app.models.weight import Weight
from app.models.health_record import HealthRecord
from app.models.house import House
from app.models.user_house import UserHouse
from app.models.house_invite import HouseInvite
from app.models.recipe import Recipe
from app.models.meal import Meal
from app.models.shopping_list import ShoppingList, ShoppingListItem, ShoppingListStatus, VerificationStatus
from app.models.store import Store
from app.models.product_catalog import ProductCatalog
from app.models.error_log import ErrorLog
from app.models.category import Category

# Export all models so they can be imported from app.models
# This also ensures they are registered with SQLAlchemy Base
__all__ = [
    "Base",
    "BaseModel",
    "User",
    "UserRole",
    "Food",
    "Weight",
    "HealthRecord",
    "House",
    "UserHouse",
    "HouseInvite",
    "Recipe",
    "Meal",
    "ShoppingList",
    "ShoppingListItem",
    "ShoppingListStatus",
    "VerificationStatus",
    "Store",
    "ProductCatalog",
    "ErrorLog",
    "Category",
]
