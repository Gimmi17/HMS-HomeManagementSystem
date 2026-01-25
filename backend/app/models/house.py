"""
House Model
Represents a household in the meal planner system.

A house is the main organizational unit where users collaborate on meal planning.
Each house has one owner and can have multiple members with different roles.
Houses store recipes, meal history, and health tracking data for all members.

Key features:
- Multi-user collaboration space
- Shared recipes and meal plans
- Configurable settings (preferences, notifications)
- Invitation system for adding members
"""

from sqlalchemy import Column, String, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class House(BaseModel):
    """
    House model representing a household for meal planning.

    Fields:
        id (UUID): Primary key, inherited from BaseModel
        owner_id (UUID): Foreign key to users table (house creator)
        name (str): Display name for the house
        description (str): Optional description of the house
        location (str): Optional physical location (city, address, etc)
        settings (dict): JSON object with house-level settings
        created_at (datetime): House creation timestamp
        updated_at (datetime): Last modification timestamp

    Relationships:
        owner: Many-to-one relationship with User (house creator)
        members: Many-to-many relationship with User through user_house
        recipes: One-to-many relationship with recipes created in this house
        meals: One-to-many relationship with meals consumed in this house
        invites: One-to-many relationship with pending invitations

    Settings JSON structure:
        {
            "timezone": "Europe/Rome",
            "notifications": {
                "meal_reminders": true,
                "grocery_alerts": true,
                "health_goals": false
            },
            "default_serving_size": 1,
            "meal_types": ["colazione", "spuntino", "pranzo", "cena"]
        }

    Example usage:
        house = House(
            owner_id=user.id,
            name="Casa Rossi",
            description="Famiglia Rossi - 4 persone",
            location="Milano, Italia",
            settings={"timezone": "Europe/Rome"}
        )
        db.add(house)
        db.commit()
    """

    __tablename__ = "houses"

    # Owner reference
    # The user who created the house and has administrative privileges
    # Cannot be null - every house must have an owner
    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete house if owner deleted
        nullable=False,
        index=True,
        comment="User who created and owns this house"
    )

    # House information
    name = Column(
        String(255),
        nullable=False,
        comment="Display name for the house"
    )

    description = Column(
        Text,
        nullable=True,
        comment="Optional description of the house and its members"
    )

    location = Column(
        String(255),
        nullable=True,
        comment="Physical location (city, address, etc)"
    )

    # House-level configuration
    # Stored as flexible JSON to allow adding new settings without migrations
    settings = Column(
        JSON,
        default={},
        nullable=False,
        comment="House settings (timezone, notifications, preferences)"
    )

    # Relationships
    # These will be properly defined when related models are imported
    # owner = relationship("User", back_populates="owned_houses")
    # members = relationship("User", secondary="user_house", back_populates="houses")
    # recipes = relationship("Recipe", back_populates="house", cascade="all, delete-orphan")
    # meals = relationship("Meal", back_populates="house", cascade="all, delete-orphan")
    # invites = relationship("HouseInvite", back_populates="house", cascade="all, delete-orphan")

    # Shopping lists relationship
    shopping_lists = relationship(
        "ShoppingList",
        back_populates="house",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        """String representation for debugging."""
        return f"<House(id={self.id}, name={self.name}, owner_id={self.owner_id})>"

    @property
    def timezone(self) -> str:
        """Get house timezone, default to UTC if not set."""
        return self.settings.get("timezone", "UTC")

    @property
    def notifications_enabled(self) -> bool:
        """Check if any notifications are enabled."""
        notifications = self.settings.get("notifications", {})
        return any(notifications.values())
