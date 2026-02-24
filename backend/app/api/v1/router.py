"""
API v1 Main Router
Aggregates all v1 API endpoints into a single router.

This file combines all individual routers (auth, users, houses, recipes, etc.)
into a single APIRouter that can be included in the main FastAPI application.

Structure:
- /auth/* - Authentication endpoints (register, login, refresh)
- /users/* - User profile endpoints (get/update profile)
- /houses/* - House management endpoints (future)
- /recipes/* - Recipe CRUD endpoints (future)
- /meals/* - Meal tracking endpoints (future)
- /foods/* - Food database endpoints (future)
- /health/* - Health tracking endpoints (future)
- /grocy/* - Grocy integration endpoints (future)
"""

from fastapi import APIRouter

from app.api.v1 import auth, users, foods, health, grocy, houses, recipes, meals, shopping_lists, stores, products, product_catalog, product_nutrition, error_logs, admin, categories, dispensa, anagrafiche, receipts, llm, environments, meal_planner


# Create main v1 router
# This router will be included in main.py with prefix /api/v1
api_router = APIRouter()


# Include authentication endpoints
# Endpoints: POST /auth/register, /auth/login, /auth/refresh
# No authentication required for these endpoints
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)


# Include user profile endpoints
# Endpoints: GET /users/me, PUT /users/me, PUT /users/me/password
# All endpoints require authentication
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"],
)


# Include houses management endpoints
# Endpoints: POST/GET/PUT/DELETE /houses, POST /houses/{id}/invites, POST /houses/join
# All endpoints require authentication
# Implements multi-user collaboration and invitation system
api_router.include_router(
    houses.router,
    # prefix is already defined in houses.router (/houses)
    tags=["Houses"],
)


# Include foods endpoints
# Endpoints: GET /foods, GET /foods/{id}, GET /foods/categories
# Read-only access to nutritional database (no authentication required in MVP)
api_router.include_router(
    foods.router,
    # prefix is already defined in foods.router (/foods)
    tags=["Foods"],
)


# Include health tracking endpoints
# Endpoints: POST/GET/PUT/DELETE /weights, POST/GET/PUT/DELETE /health
# Requires authentication (TODO: add auth middleware)
api_router.include_router(
    health.router,
    # No prefix needed, endpoints define their own paths (/weights, /health)
    tags=["Health"],
)


# Include Grocy integration endpoints
# Endpoints: GET /grocy/stock, GET /grocy/products, GET /grocy/products/{id}
# Proxy endpoints for Grocy inventory system integration
# No authentication required in MVP (read-only, graceful degradation if not configured)
api_router.include_router(
    grocy.router,
    # prefix is already defined in grocy.router (/grocy)
    tags=["Grocy Integration"],
)


# Include recipes endpoints
# Endpoints: POST/GET/PUT/DELETE /recipes
# CRUD operations for recipes with automatic nutrition calculation
# Requires authentication for create/update/delete operations
api_router.include_router(
    recipes.router,
    # prefix is already defined in recipes.router (/recipes)
    tags=["Recipes"],
)


# Include meals endpoints
# Endpoints: POST/GET/DELETE /meals, GET /meals/summary/daily, GET /meals/summary/period
# Meal tracking and nutritional analytics
# Requires authentication for create/delete operations
api_router.include_router(
    meals.router,
    # prefix is already defined in meals.router (/meals)
    tags=["Meals"],
)


# Include shopping lists endpoints
# Endpoints: POST/GET/PUT/DELETE /shopping-lists, items management
# Shopping list management with Grocy integration
# Requires authentication
api_router.include_router(
    shopping_lists.router,
    # prefix is already defined in shopping_lists.router (/shopping-lists)
    tags=["Shopping Lists"],
)


# Include products endpoints
# Endpoints: GET /products/lookup/{barcode}
# Product lookup using Open Food Facts database
# Requires authentication
api_router.include_router(
    products.router,
    # prefix is already defined in products.router (/products)
    tags=["Products"],
)


# Include stores endpoints
# Endpoints: POST/GET/PUT/DELETE /stores
# Store management (shared across all houses for ordering data)
# Requires authentication
api_router.include_router(
    stores.router,
    # prefix is already defined in stores.router (/stores)
    tags=["Stores"],
)


# Include product catalog endpoints
# Endpoints: GET /product-catalog, GET /product-catalog/barcode/{barcode}, GET /product-catalog/enrichment-status
# Local product catalog and enrichment queue status
# Requires authentication
api_router.include_router(
    product_catalog.router,
    # prefix is already defined in product_catalog.router (/product-catalog)
    tags=["Product Catalog"],
)


# Include product nutrition endpoints
# Endpoints: GET/POST/PUT/DELETE /product-nutrition
# Detailed nutritional data from Open Food Facts API or manual entry
# Requires authentication
api_router.include_router(
    product_nutrition.router,
    # prefix is already defined in product_nutrition.router (/product-nutrition)
    tags=["Product Nutrition"],
)


# Include error logs endpoints
# Endpoints: GET /error-logs, GET /error-logs/stats, GET /error-logs/{id}, POST /error-logs/{id}/resolve
# Error log management (admin only)
# Requires admin authentication
api_router.include_router(
    error_logs.router,
    # prefix is already defined in error_logs.router (/error-logs)
    tags=["Error Logs"],
)


# Include admin endpoints
# Endpoints: POST /admin/import-database
# Database import functionality (one-shot migration tool)
# Requires authentication
api_router.include_router(
    admin.router,
    # prefix is already defined in admin.router (/admin)
    tags=["Admin"],
)


# Include categories endpoints
# Endpoints: POST/GET/PUT/DELETE /categories
# Product category management (shared across all houses)
# Requires authentication
api_router.include_router(
    categories.router,
    # prefix is already defined in categories.router (/categories)
    tags=["Categories"],
)


# Include dispensa endpoints
# Endpoints: GET/POST /dispensa, GET /dispensa/stats, POST /dispensa/from-shopping-list
# GET/PUT/DELETE /dispensa/{id}, POST /dispensa/{id}/consume, POST /dispensa/{id}/unconsume
# Pantry management with consumption tracking and shopping list integration
# Requires authentication
api_router.include_router(
    dispensa.router,
    # prefix is already defined in dispensa.router (/dispensa)
    tags=["Dispensa"],
)


# Include environments endpoints
# Endpoints: GET/POST /environments, PUT/DELETE /environments/{id}, GET /environments/{id}/stats, POST /environments/seed
# Environment management for organizing items into locations
# Requires authentication
api_router.include_router(
    environments.router,
    # prefix is already defined in environments.router (/environments)
    tags=["Environments"],
)


# Include anagrafiche endpoints
# Endpoints: CRUD for users, houses, foods, products
# Master data management for admin purposes
# Requires authentication
api_router.include_router(
    anagrafiche.router,
    # prefix is already defined in anagrafiche.router (/anagrafiche)
    tags=["Anagrafiche"],
)


# Include receipts endpoints
# Endpoints: POST/GET/DELETE /receipts, OCR processing, reconciliation
# Receipt scanning and shopping list reconciliation
# Requires authentication
api_router.include_router(
    receipts.router,
    # prefix is already defined in receipts.router (/receipts)
    tags=["Receipts"],
)


# Include LLM configuration endpoints
# Endpoints: GET/POST/PUT/DELETE /llm/connections, POST /llm/test
# LLM connection management for OCR enhancement and future features
# Requires authentication
api_router.include_router(
    llm.router,
    # prefix is already defined in llm.router (/llm)
    tags=["LLM"],
)


# Include meal planner endpoints
# Endpoints: POST /meal-planner/generate, POST /meal-planner/confirm
# Meal planning wizard with LLM-powered suggestions
# Requires authentication
api_router.include_router(
    meal_planner.router,
    # prefix is already defined in meal_planner.router (/meal-planner)
    tags=["Meal Planner"],
)
