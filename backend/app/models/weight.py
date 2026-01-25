"""
Weight Model
Stores user weight measurements for health tracking.

This model tracks weight measurements over time for users in a house.
Used for monitoring weight trends, fitness goals, and health metrics.

Features:
    - Multiple measurements per user
    - Time-series data for trend analysis
    - Optional notes for context (e.g., "after workout", "morning weight")
"""

from sqlalchemy import Column, ForeignKey, Numeric, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Weight(BaseModel):
    """
    Weight measurement tracking model.

    Allows users to record their weight over time to monitor health trends,
    fitness goals, or medical requirements. Each measurement is timestamped
    and can include optional notes for context.

    Relationships:
        - Belongs to a User (who recorded the weight)
        - Belongs to a House (multi-tenant isolation)

    Use Cases:
        - Daily/weekly weight tracking for fitness goals
        - Medical weight monitoring
        - Trend analysis for diet effectiveness
        - Integration with meal planning for calorie targets

    Example:
        User records weight every Monday morning:
        - 2024-01-01: 75.5 kg (notes: "After holidays")
        - 2024-01-08: 74.8 kg (notes: "Back to routine")
        - 2024-01-15: 74.2 kg (notes: "Feeling good")
    """

    __tablename__ = "weights"

    # Foreign Key: User
    # -----------------
    # Reference to the user who owns this weight measurement
    # Used for filtering: show only my weight records
    # NOT NULL: every weight must belong to a user
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete weights if user is deleted
        nullable=False,
        index=True,  # Index for fast user-based queries
        comment="User who recorded this weight measurement"
    )

    # Foreign Key: House
    # ------------------
    # Reference to the house this weight belongs to (multi-tenant isolation)
    # Ensures weight data is isolated per household
    # Used in queries to filter weights by house context
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),  # Delete weights if house is deleted
        nullable=False,
        index=True,  # Index for house-based filtering
        comment="House this weight record belongs to"
    )

    # Weight Value
    # ------------
    # Weight in kilograms (supports decimals for precision)
    # Numeric(6, 2) allows values like 123.45 kg (max 9999.99 kg)
    # NOT NULL: weight is required field
    weight_kg = Column(
        Numeric(6, 2),
        nullable=False,
        comment="Weight in kilograms (e.g., 75.50)"
    )

    # Measurement Timestamp
    # ---------------------
    # When the weight was measured (not when it was recorded in the system)
    # Users can backfill historical data or record measurements retroactively
    # NOT NULL: measurement time is required
    # Indexed for time-series queries (get weights in date range)
    measured_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # Index for date range queries
        comment="When the weight was measured (user-provided timestamp)"
    )

    # Optional Notes
    # --------------
    # Free-text field for contextual information
    # Examples: "after workout", "morning weight", "post-meal", "before diet"
    # Helps users remember circumstances of measurement
    notes = Column(
        Text,
        nullable=True,
        comment="Optional notes about measurement context"
    )

    # Relationships
    # -------------
    # These are SQLAlchemy relationships for easy navigation between models
    # Example: weight.user.email or weight.house.name

    # Relationship to User model (back-populated as user.weights)
    # user = relationship("User", back_populates="weights")

    # Relationship to House model (back-populated as house.weights)
    # house = relationship("House", back_populates="weights")

    def __repr__(self):
        """String representation for debugging."""
        return (
            f"<Weight(user_id={self.user_id}, weight_kg={self.weight_kg}, "
            f"measured_at={self.measured_at})>"
        )

    @property
    def weight_lbs(self) -> float:
        """
        Convert weight to pounds for display purposes.

        Returns:
            float: Weight in pounds (1 kg = 2.20462 lbs)

        Example:
            weight = Weight(weight_kg=75.5)
            print(weight.weight_lbs)  # 166.44891
        """
        if self.weight_kg:
            return float(self.weight_kg) * 2.20462
        return 0.0


# Note on Composite Indexes:
# A composite index on (user_id, measured_at) would optimize common queries like:
#   SELECT * FROM weights WHERE user_id = 'xxx' ORDER BY measured_at DESC
# This is the most common query pattern for weight tracking (show user's weight history)
#
# This can be added later via Alembic migration if needed:
#   CREATE INDEX idx_weights_user_date ON weights(user_id, measured_at DESC);
