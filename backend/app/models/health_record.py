"""
HealthRecord Model
Stores health events and symptoms tracking.

This model allows users to log health-related events such as illnesses,
symptoms, allergies, injuries, or general wellness notes. Used for tracking
correlations between diet, lifestyle, and health outcomes.

Use Cases:
    - Track illnesses (cold, flu, headache)
    - Log allergic reactions
    - Record injuries or pain
    - Monitor chronic conditions
    - Correlate health events with meals/diet
"""

from sqlalchemy import Column, ForeignKey, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class HealthRecord(BaseModel):
    """
    Health event tracking model.

    Stores user-reported health events, symptoms, and wellness data.
    Can be used to identify patterns, triggers, or correlations with diet.

    Relationships:
        - Belongs to a User (who reported the health event)
        - Belongs to a House (multi-tenant isolation)

    Common Types:
        - "cold": Common cold symptoms
        - "flu": Influenza symptoms
        - "headache": Headaches or migraines
        - "allergy": Allergic reactions
        - "injury": Physical injuries
        - "stomach": Digestive issues
        - "fatigue": Tiredness or low energy
        - "other": Custom health events

    Severity Levels:
        - "mild": Minor discomfort, doesn't affect daily activities
        - "moderate": Noticeable symptoms, some impact on activities
        - "severe": Significant impact, may require medical attention

    Example Usage:
        User notices pattern between dairy consumption and stomach issues:
        - 2024-01-05: type="stomach", severity="moderate", "Bloating after lunch"
        - 2024-01-12: type="stomach", severity="mild", "Discomfort after pizza"
        - Analysis reveals correlation with high-dairy meals
    """

    __tablename__ = "health_records"

    # Foreign Key: User
    # -----------------
    # Reference to the user this health record belongs to
    # Health data is personal and user-specific
    # NOT NULL: every health record must have an owner
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),  # Delete records if user is deleted
        nullable=False,
        index=True,  # Index for user-specific queries
        comment="User who recorded this health event"
    )

    # Foreign Key: House
    # ------------------
    # Reference to the house (multi-tenant isolation)
    # Allows household members to optionally share health trends
    # (e.g., "Everyone got sick after eating X")
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),  # Delete records if house is deleted
        nullable=False,
        index=True,  # Index for house-level analytics
        comment="House this health record belongs to"
    )

    # Health Event Type
    # -----------------
    # Classification of the health event
    # Free-form string to allow custom types (not enum for flexibility)
    # Common values: "cold", "flu", "headache", "allergy", "injury", "stomach", "fatigue"
    # Frontend can suggest common types but allow custom input
    type = Column(
        String(100),
        nullable=True,  # Optional: user might just write a description
        index=True,  # Index for grouping by type in analytics
        comment="Health event type (e.g., 'cold', 'headache', 'allergy')"
    )

    # Description
    # -----------
    # Free-text description of symptoms, feelings, or event details
    # This is the primary field for user input
    # NOT NULL: description is required (main content of health record)
    # Examples:
    #   - "Woke up with severe headache, sensitivity to light"
    #   - "Stomachache after dinner, possibly dairy intolerance"
    #   - "Seasonal allergies acting up, sneezing and watery eyes"
    description = Column(
        Text,
        nullable=False,
        comment="Detailed description of health event or symptoms"
    )

    # Severity Level
    # --------------
    # Subjective severity rating from user perspective
    # Values: "mild", "moderate", "severe"
    # Optional: user might not always specify severity
    # Useful for filtering serious events or tracking progression
    severity = Column(
        String(50),
        nullable=True,
        comment="Severity level: 'mild', 'moderate', or 'severe'"
    )

    # Event Timestamp
    # ---------------
    # When the health event occurred or was first noticed
    # Users can backfill historical data
    # NOT NULL: timestamp is required for time-series analysis
    # Indexed for date-range queries and trend analysis
    recorded_at = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # Index for temporal queries
        comment="When the health event occurred (user-provided timestamp)"
    )

    # Relationships
    # -------------
    # SQLAlchemy relationships for navigating between models

    # Relationship to User model (back-populated as user.health_records)
    # user = relationship("User", back_populates="health_records")

    # Relationship to House model (back-populated as house.health_records)
    # house = relationship("House", back_populates="health_records")

    def __repr__(self):
        """String representation for debugging."""
        return (
            f"<HealthRecord(user_id={self.user_id}, type='{self.type}', "
            f"severity='{self.severity}', recorded_at={self.recorded_at})>"
        )

    @property
    def severity_emoji(self) -> str:
        """
        Get emoji representation of severity for UI display.

        Returns:
            str: Emoji representing severity level

        Example:
            record = HealthRecord(severity="severe")
            print(record.severity_emoji)  # "🔴"
        """
        severity_map = {
            "mild": "🟢",
            "moderate": "🟡",
            "severe": "🔴",
        }
        return severity_map.get(self.severity.lower() if self.severity else "", "⚪")


# Future Enhancement Ideas:
# -------------------------
# 1. Add tags field (JSONB) for custom categorization:
#    tags = Column(JSONB, default=[])  # ["food-related", "stress", "weather"]
#
# 2. Add correlation fields to link with meals:
#    related_meal_id = Column(UUID, ForeignKey("meals.id"), nullable=True)
#    suspected_trigger_food_id = Column(UUID, ForeignKey("foods.id"), nullable=True)
#
# 3. Add duration tracking:
#    duration_hours = Column(Numeric(6, 2), nullable=True)
#    resolved_at = Column(DateTime, nullable=True)
#
# 4. Add medical metadata:
#    medication_taken = Column(Text, nullable=True)
#    doctor_visited = Column(Boolean, default=False)
#
# These can be added later via migrations as needed.
