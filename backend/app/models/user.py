"""
User Model
Represents users in the meal planner system.

Each user has:
- Unique email for authentication
- Encrypted password (never stored in plain text)
- Profile information (name, avatar)
- Personal preferences (dietary restrictions, allergies, goals)
- Membership in one or more houses through user_house association

A user can belong to multiple houses with different roles (OWNER, MEMBER, GUEST).
"""

from sqlalchemy import Column, String, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """User role types."""
    ADMIN = "admin"
    BASIC = "basic"


class User(BaseModel):
    """
    User model for authentication and profile management.

    Fields:
        id (UUID): Primary key, inherited from BaseModel
        email (str): Unique email address for login
        password_hash (str): Bcrypt hashed password
        full_name (str): User's display name
        avatar_url (str): URL to profile picture
        preferences (dict): JSON object with user preferences
        created_at (datetime): Account creation timestamp
        updated_at (datetime): Last profile update timestamp

    Relationships:
        houses: Many-to-many relationship with House through user_house
        owned_houses: One-to-many relationship with houses where user is owner
        meals: One-to-many relationship with user's consumed meals
        weights: One-to-many relationship with weight records
        health_records: One-to-many relationship with health records

    Preferences JSON structure:
        {
            "dietary_type": "vegetarian" | "vegan" | "omnivore" | "pescatarian",
            "allergies": ["gluten", "lactose", "nuts"],
            "health_goals": ["weight_loss", "muscle_gain", "maintenance"],
            "daily_calorie_target": 2000,
            "macro_targets": {
                "proteins_g": 150,
                "carbs_g": 200,
                "fats_g": 65
            }
        }

    Example usage:
        user = User(
            email="user@example.com",
            password_hash=hash_password("secret123"),
            full_name="Mario Rossi",
            preferences={
                "dietary_type": "vegetarian",
                "allergies": ["lactose"]
            }
        )
        db.add(user)
        db.commit()
    """

    __tablename__ = "users"

    # Authentication fields
    # Email must be unique across all users for login purposes
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,  # Index for fast lookups during login
        comment="User's email address for authentication"
    )

    # Password hash - NEVER store plain text passwords
    # Generated using bcrypt with salt for security
    password_hash = Column(
        String(255),
        nullable=False,
        comment="Bcrypt hashed password"
    )

    # Profile information
    full_name = Column(
        String(255),
        nullable=True,
        comment="User's full display name"
    )

    avatar_url = Column(
        String(255),
        nullable=True,
        comment="URL to user's profile picture"
    )

    # User preferences stored as flexible JSON
    # Allows adding new preference fields without schema migrations
    # Default to empty dict if not provided
    preferences = Column(
        JSON,
        default={},
        nullable=False,
        comment="User preferences (dietary, allergies, goals, etc)"
    )

    # User role - determines access level
    # ADMIN: full access to all features and settings
    # BASIC: standard user access
    role = Column(
        SQLEnum(UserRole),
        default=UserRole.BASIC,
        nullable=False,
        comment="User role (admin, basic)"
    )

    # Relationships
    # Note: Actual relationship definitions will be added when related models are created
    # This prevents circular import issues

    def __repr__(self):
        """String representation for debugging."""
        return f"<User(id={self.id}, email={self.email}, name={self.full_name})>"

    @property
    def is_vegetarian(self) -> bool:
        """Helper property to check if user is vegetarian."""
        dietary_type = self.preferences.get("dietary_type", "")
        return dietary_type in ["vegetarian", "vegan"]

    @property
    def allergies(self) -> list:
        """Get list of user's allergies."""
        return self.preferences.get("allergies", [])

    @property
    def daily_calorie_target(self) -> int:
        """Get user's daily calorie target, default 2000 if not set."""
        return self.preferences.get("daily_calorie_target", 2000)

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role == UserRole.ADMIN
