"""
Database Session Management
Creates and manages SQLAlchemy database engine and session factory.

This module sets up the database connection using SQLAlchemy 2.0 style
and provides a session factory for creating database sessions in endpoints.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings


# Create SQLAlchemy engine
# The engine is the starting point for any SQLAlchemy application.
# It maintains a pool of database connections for efficiency.
#
# Configuration:
# - echo=settings.DEBUG: Log all SQL queries when debug mode is enabled
# - pool_pre_ping=True: Verify connections before using them (prevents stale connections)
# - pool_recycle=3600: Recycle connections after 1 hour (prevents timeout issues)
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    pool_pre_ping=True,  # Check connection health before using
    pool_recycle=3600,  # Recycle connections every hour
)

# Session factory
# Creates new database sessions on demand.
# Sessions are used to interact with the database (queries, inserts, updates, etc.)
#
# Configuration:
# - autocommit=False: Require explicit commit() calls (safer, more control)
# - autoflush=False: Require explicit flush() calls (more predictable behavior)
# - bind=engine: Connect sessions to our database engine
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function that provides database sessions to FastAPI endpoints.

    This generator function is used as a FastAPI dependency to inject
    database sessions into endpoint functions. It automatically handles
    session creation and cleanup.

    Yields:
        Database session object

    Usage in FastAPI endpoint:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()

    The session is automatically closed after the endpoint returns,
    even if an exception occurs (thanks to try/finally block).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
