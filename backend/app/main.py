"""
Main FastAPI Application
Entry point for the HMS API.

This module creates and configures the FastAPI application instance,
sets up middleware, and defines the health check endpoint.
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os

from app.core.config import settings
from app.middleware.cors import setup_cors
from app.middleware.error_handler import ErrorHandlerMiddleware
from sqlalchemy import inspect, text
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
    HMS API - Home Management System REST API.

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

    # Auto-migrate: add missing columns to existing tables
    inspector = inspect(engine)
    migration_count = 0
    for table in Base.metadata.tables.values():
        if inspector.has_table(table.name):
            existing_columns = {col['name'] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing_columns:
                    col_type = column.type.compile(engine.dialect)
                    # Determine default value
                    default_val = None
                    if column.server_default is not None:
                        default_val = column.server_default.arg
                    elif column.default is not None and column.default.is_scalar:
                        # Use Python-level default
                        val = column.default.arg
                        if isinstance(val, bool):
                            default_val = "TRUE" if val else "FALSE"
                        elif isinstance(val, (int, float)):
                            default_val = str(val)
                        elif isinstance(val, str):
                            default_val = f"'{val}'"
                    # For NOT NULL columns, always add as NULL first then alter
                    if not column.nullable and default_val is not None:
                        stmt = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type} NULL DEFAULT {default_val}'
                        with engine.begin() as conn:
                            conn.execute(text(stmt))
                            conn.execute(text(f'UPDATE "{table.name}" SET "{column.name}" = {default_val} WHERE "{column.name}" IS NULL'))
                            conn.execute(text(f'ALTER TABLE "{table.name}" ALTER COLUMN "{column.name}" SET NOT NULL'))
                    elif not column.nullable:
                        # NOT NULL without any default - add as NULL to avoid crash
                        stmt = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type} NULL'
                        with engine.begin() as conn:
                            conn.execute(text(stmt))
                    else:
                        stmt = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type} NULL'
                        with engine.begin() as conn:
                            conn.execute(text(stmt))
                    print(f"  + Added column {table.name}.{column.name}")
                    migration_count += 1
    if migration_count:
        print(f"✓ Auto-migration: {migration_count} columns added")
    else:
        print(f"✓ Database schema up to date")

    # Migrate: make product_catalog.barcode nullable
    try:
        col_info = inspector.get_columns("product_catalog")
        bc_col = next((c for c in col_info if c['name'] == 'barcode'), None)
        if bc_col and not bc_col.get('nullable', True):
            with engine.begin() as conn:
                conn.execute(text('ALTER TABLE product_catalog ALTER COLUMN barcode DROP NOT NULL'))
            print("✓ product_catalog.barcode made nullable")
    except Exception as e:
        print(f"  ⚠ barcode nullable migration skipped: {e}")

    # Migrate: copy existing barcodes to product_barcodes
    from app.models.product_catalog import ProductCatalog
    from app.models.product_barcode import ProductBarcode
    db = SessionLocal()
    try:
        products = db.query(ProductCatalog).filter(
            ProductCatalog.barcode.isnot(None),
            ProductCatalog.barcode != ''
        ).all()
        migrated = 0
        for p in products:
            exists = db.query(ProductBarcode).filter(ProductBarcode.barcode == p.barcode).first()
            if not exists:
                db.add(ProductBarcode(
                    product_id=p.id,
                    barcode=p.barcode,
                    is_primary=True,
                    source=p.source
                ))
                migrated += 1
        db.commit()
        if migrated:
            print(f"✓ Migrated {migrated} barcodes to product_barcodes")
        else:
            print(f"✓ product_barcodes already up to date")
    except Exception as e:
        db.rollback()
        print(f"  ⚠ barcode migration error: {e}")
    finally:
        db.close()

    # Seed hardcoded barcode lookup sources
    from app.services.barcode_source_service import seed_hardcoded_sources
    db = SessionLocal()
    try:
        seed_hardcoded_sources(db)
        print(f"✓ Barcode lookup sources seeded")
    finally:
        db.close()

    # Migrate: rename environments → areas
    try:
        if inspector.has_table("environments") and not inspector.has_table("areas"):
            with engine.begin() as conn:
                conn.execute(text('ALTER TABLE environments RENAME TO areas'))
                # Rename env_type → area_type
                existing_cols = {c['name'] for c in inspector.get_columns("environments")}
                if 'env_type' in existing_cols:
                    conn.execute(text('ALTER TABLE areas RENAME COLUMN env_type TO area_type'))
                # Rename enum type
                conn.execute(text("DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'environmenttype') THEN ALTER TYPE environmenttype RENAME TO areatype; END IF; END $$"))
            print("✓ Renamed table environments → areas")
        elif inspector.has_table("areas"):
            # Table already renamed, check column
            area_cols = {c['name'] for c in inspector.get_columns("areas")}
            if 'env_type' in area_cols:
                with engine.begin() as conn:
                    conn.execute(text('ALTER TABLE areas RENAME COLUMN env_type TO area_type'))
                print("✓ Renamed column areas.env_type → area_type")
    except Exception as e:
        print(f"  ⚠ environments→areas rename skipped: {e}")

    # Migrate: rename environment_id → area_id in referencing tables
    for tbl, old_col, new_col in [
        ("dispensa_items", "environment_id", "area_id"),
        ("categories", "default_environment_id", "default_area_id"),
        ("product_category_tags", "default_environment_id", "default_area_id"),
    ]:
        try:
            if inspector.has_table(tbl):
                cols = {c['name'] for c in inspector.get_columns(tbl)}
                if old_col in cols and new_col not in cols:
                    with engine.begin() as conn:
                        conn.execute(text(f'ALTER TABLE {tbl} RENAME COLUMN {old_col} TO {new_col}'))
                    print(f"✓ Renamed {tbl}.{old_col} → {new_col}")
        except Exception as e:
            print(f"  ⚠ {tbl} column rename skipped: {e}")

    # Update FK constraints to point to areas table
    for tbl, col in [
        ("dispensa_items", "area_id"),
        ("categories", "default_area_id"),
        ("product_category_tags", "default_area_id"),
    ]:
        try:
            if inspector.has_table(tbl):
                cols = {c['name'] for c in inspector.get_columns(tbl)}
                if col in cols:
                    fks = inspector.get_foreign_keys(tbl)
                    for fk in fks:
                        if col in fk.get('constrained_columns', []) and fk.get('referred_table') == 'environments':
                            fk_name = fk.get('name')
                            if fk_name:
                                with engine.begin() as conn:
                                    conn.execute(text(f'ALTER TABLE {tbl} DROP CONSTRAINT {fk_name}'))
                                    conn.execute(text(f'ALTER TABLE {tbl} ADD CONSTRAINT {fk_name} FOREIGN KEY ({col}) REFERENCES areas(id) ON DELETE SET NULL'))
                                print(f"✓ Updated FK {tbl}.{col} → areas")
        except Exception as e:
            print(f"  ⚠ FK update for {tbl}.{col} skipped: {e}")

    # Backfill: set expiry_extension_enabled=True on default Congelatore areas
    from app.models.area import Area
    db = SessionLocal()
    try:
        updated = db.query(Area).filter(
            Area.name == "Congelatore",
            Area.is_default == True,
            Area.expiry_extension_enabled == False,
        ).update({"expiry_extension_enabled": True})
        if updated:
            db.commit()
            print(f"✓ Backfill: {updated} Congelatore area(s) updated with expiry_extension_enabled=True")
        else:
            print(f"✓ Congelatore areas already have expiry_extension_enabled")
    except Exception as e:
        db.rollback()
        print(f"  ⚠ Congelatore backfill skipped: {e}")
    finally:
        db.close()

    # Seed default areas for houses that don't have any
    from app.models.house import House
    from app.services.area_service import AreaService
    db = SessionLocal()
    try:
        houses_without_areas = db.query(House).filter(
            ~House.id.in_(
                db.query(Area.house_id).distinct()
            )
        ).all()
        for house in houses_without_areas:
            area_count = AreaService.seed_defaults(db, house.id)
            orphan_count = AreaService.assign_orphaned_items(db, house.id)
            if area_count or orphan_count:
                print(f"  + House '{house.name}': {area_count} areas seeded, {orphan_count} orphaned items assigned")
        db.commit()
        print(f"✓ Default areas seeded")
    finally:
        db.close()

    # Configure error logging system
    configure_error_logging(SessionLocal)
    print(f"✓ Error logging system configured")

    # Check receipts directory persistence
    receipts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "receipts")
    os.makedirs(receipts_dir, exist_ok=True)
    marker = os.path.join(receipts_dir, ".volume_check")
    if os.path.exists(marker):
        print(f"✓ Receipts storage is persistent")
    else:
        with open(marker, "w") as f:
            f.write("volume persistence marker")
        print(f"⚠ WARNING: Receipts directory may not be on a persistent volume!")
        print(f"  If this message appears after every restart, mount a volume at /app/data/receipts")

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
            "api": "HMS API"
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
        "message": "Welcome to HMS API",
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
