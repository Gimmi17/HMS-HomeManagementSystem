"""
Main FastAPI Application
Entry point for the Meal Planner API.

This module creates and configures the FastAPI application instance,
sets up middleware, and defines the health check endpoint.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.middleware.cors import setup_cors
from app.middleware.error_handler import ErrorHandlerMiddleware
from app.db.session import engine, SessionLocal
from app.models import Base
from app.services.error_logging import configure_error_logging, error_logger


# Create FastAPI application instance
# This is the main application object that handles all HTTP requests.
#
# Configuration:
# - title: Displayed in auto-generated API documentation
# - version: API version for documentation and versioning
# - docs_url: Swagger UI endpoint (interactive API documentation)
# - redoc_url: ReDoc endpoint (alternative documentation style)
# - description: Detailed info shown in docs
app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",  # Swagger UI at http://localhost:8000/docs
    redoc_url="/redoc",  # ReDoc at http://localhost:8000/redoc
    description="""
    Meal Planner API - REST API for meal planning and nutritional tracking.

    Features:
    - Multi-user authentication with JWT
    - Recipe management with automatic nutritional calculations
    - Meal tracking and history
    - Grocy inventory integration
    - Health and weight tracking
    - Multi-house membership system

    For more information, visit the documentation at /docs
    """
)


# Setup CORS middleware
# Must be called before adding routes to allow cross-origin requests
# from the frontend React application (port 3000)
setup_cors(app)

# Setup error handler middleware
# Catches all unhandled exceptions and logs them
app.add_middleware(ErrorHandlerMiddleware)


@app.on_event("startup")
async def startup_event():
    """
    Application startup handler.

    Executed once when the FastAPI application starts.

    Tasks performed:
    - Create all database tables if they don't exist
    - Initialize database schema based on SQLAlchemy models
    - Configure error logging system

    Note: In production, use Alembic migrations instead of
    Base.metadata.create_all() for better schema management.
    """
    # Create all database tables
    # This reads all models that inherit from Base and creates their tables
    # Only creates tables that don't already exist (safe to run multiple times)
    Base.metadata.create_all(bind=engine)
    print(f"✓ Database tables created/verified")

    # Configure error logging system
    configure_error_logging(SessionLocal)
    print(f"✓ Error logging system configured")

    print(f"✓ API documentation available at http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Application shutdown handler.

    Executed once when the FastAPI application shuts down.
    Can be used for cleanup tasks like closing connections.
    """
    print("✓ Application shutdown complete")


@app.get(
    "/health",
    tags=["Health"],
    summary="Health Check",
    description="Simple endpoint to verify API is running"
)
async def health_check():
    """
    Health check endpoint.

    Returns basic status information about the API.
    Used by monitoring tools and container orchestrators to verify
    the application is running correctly.

    Returns:
        JSON response with status and version information

    Example Response:
        {
            "status": "ok",
            "version": "1.0.0",
            "api": "Meal Planner API"
        }
    """
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "version": "1.0.0",
            "api": settings.PROJECT_NAME
        }
    )


@app.get(
    "/",
    tags=["Root"],
    summary="API Root",
    description="Root endpoint with API information"
)
async def root():
    """
    API root endpoint.

    Provides basic information about the API and links to documentation.

    Returns:
        JSON response with API information and documentation links
    """
    return {
        "message": "Welcome to Meal Planner API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health"
    }


# Include API v1 router
# All v1 endpoints are prefixed with /api/v1
# Individual routers (auth, users, etc.) are combined in api.v1.router
from app.api.v1.router import api_router

app.include_router(
    api_router,
    prefix=f"/api/{settings.API_VERSION}",
)

# API Documentation:
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
#
# Available endpoints:
# - POST /api/v1/auth/register - Create new user account
# - POST /api/v1/auth/login - Authenticate and get tokens
# - POST /api/v1/auth/refresh - Refresh access token
# - GET /api/v1/users/me - Get current user profile
# - PUT /api/v1/users/me - Update current user profile
# - PUT /api/v1/users/me/password - Change password
