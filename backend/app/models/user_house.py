"""
UserHouse Model (Association Table)
Many-to-many relationship between Users and Houses.

This model represents house membership and tracks:
- Which users belong to which houses
- Their role in each house (OWNER, MEMBER, GUEST)
- When they joined the house

A user can belong to multiple houses, and a house can have multiple users.
This is the central model for multi-user collaboration.
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class UserHouse(Base):
    """
    Association model for user-house membership.

    This is a many-to-many relationship table with additional fields.
    Unlike a simple association table, this has composite primary key
    and stores metadata about the membership.

    Fields:
        user_id (UUID): Foreign key to users table (composite PK)
        house_id (UUID): Foreign key to houses table (composite PK)
        role (str): User's role in this house
        joined_at (datetime): Timestamp when user joined the house

    Roles:
        - OWNER: House creator, full administrative access
                 Can modify house settings, remove members, delete house
        - MEMBER: Regular member, can create recipes and log meals
                  Can view house data and collaborate with other members
        - GUEST: Read-only access, can view recipes but cannot modify
                 Useful for temporary access or observers

    Example usage:
        # Add user to house as MEMBER
        membership = UserHouse(
            user_id=user.id,
            house_id=house.id,
            role="MEMBER"
        )
        db.add(membership)
        db.commit()

        # Query all houses for a user
        user_houses = db.query(UserHouse).filter(
            UserHouse.user_id == user.id
        ).all()

        # Query all members of a house
        house_members = db.query(UserHouse).filter(
            UserHouse.house_id == house.id
        ).all()
    """

    __tablename__ = "user_house"

    # Composite primary key: (user_id, house_id)
    # This ensures a user can only have one membership per house
    # No duplicate memberships allowed
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete membership if user deleted
        primary_key=True,
        comment="User who is a member of the house"
    )

    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),  # Delete membership if house deleted
        primary_key=True,
        comment="House the user belongs to"
    )

    # Membership role
    # Determines what actions the user can perform in this house
    # Default is MEMBER for new users joining via invite
    role = Column(
        String(50),
        default="MEMBER",
        nullable=False,
        comment="User's role in this house: OWNER, MEMBER, or GUEST"
    )

    # Membership timestamp
    # Records when the user joined the house
    # Useful for analytics and membership history
    joined_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when user joined the house"
    )

    # Relationships
    # user = relationship("User", back_populates="house_memberships")
    # house = relationship("House", back_populates="memberships")

    def __repr__(self):
        """String representation for debugging."""
        return f"<UserHouse(user_id={self.user_id}, house_id={self.house_id}, role={self.role})>"

    @property
    def is_owner(self) -> bool:
        """Check if this membership represents an owner role."""
        return self.role == "OWNER"

    @property
    def can_modify_house(self) -> bool:
        """Check if user can modify house settings."""
        return self.role == "OWNER"

    @property
    def can_create_recipes(self) -> bool:
        """Check if user can create recipes in this house."""
        return self.role in ["OWNER", "MEMBER"]

    @property
    def can_log_meals(self) -> bool:
        """Check if user can log meals in this house."""
        return self.role in ["OWNER", "MEMBER"]
