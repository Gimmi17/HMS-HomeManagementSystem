"""
Base Model Class
Provides common fields and functionality for all database models.

All application models should inherit from BaseModel instead of Base directly.
This ensures consistent ID format (UUID) and automatic timestamp tracking.
"""

from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base


class BaseModel(Base):
    """
    Abstract base model with common fields for all tables.

    Provides:
    - UUID primary key (more secure and distributed than auto-increment)
    - created_at timestamp (automatically set on insert)
    - updated_at timestamp (automatically updated on modification)

    All models (User, House, Recipe, etc.) should inherit from this class.

    Example:
        class User(BaseModel):
            __tablename__ = "users"
            email = Column(String, unique=True)
            # id, created_at, updated_at are inherited automatically
    """

    # Make this an abstract base class (no table created for BaseModel itself)
    __abstract__ = True

    # Primary Key: UUID
    # UUIDs are preferred over auto-increment integers because:
    # - Can be generated client-side (distributed systems)
    # - No sequential guessing of IDs (more secure)
    # - Easier to merge databases from different sources
    # - Standard format across all tables
    id = Column(
        UUID(as_uuid=True),  # Store as native UUID type in PostgreSQL
        primary_key=True,
        default=uuid.uuid4,  # Auto-generate UUID v4 on insert
        nullable=False
    )

    # Timestamp: Record Creation
    # Automatically set to current time when record is first inserted.
    # server_default ensures the database sets this value even if not provided.
    created_at = Column(
        DateTime(timezone=True),  # Store with timezone info
        server_default=func.now(),  # PostgreSQL NOW() function
        nullable=False
    )

    # Timestamp: Last Update
    # Automatically updated to current time whenever record is modified.
    # onupdate ensures this field is refreshed on every UPDATE query.
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),  # Initial value on insert
        onupdate=func.now(),  # Update on every modification
        nullable=False
    )

    def __repr__(self):
        """
        String representation of model instance.
        Useful for debugging and logging.
        """
        return f"<{self.__class__.__name__}(id={self.id})>"
