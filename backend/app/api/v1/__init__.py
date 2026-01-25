"""
API v1 Module
Contains all version 1 API endpoints.
"""

# Expose routers for easy import
from app.api.v1 import auth, users, foods, health, houses, grocy

__all__ = ["auth", "users", "foods", "health", "houses", "grocy"]
