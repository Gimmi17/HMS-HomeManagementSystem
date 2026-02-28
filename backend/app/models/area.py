"""
Area Model
Manages areas (locations) within a house for organizing items.

Examples: Dispensa, Frigorifero, Congelatore, Borsa Attrezzi, Garage, etc.
"""

import enum
from sqlalchemy import Column, String, ForeignKey, Boolean, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class AreaType(str, enum.Enum):
    FOOD_STORAGE = "food_storage"
    EQUIPMENT = "equipment"
    GENERAL = "general"


class Area(BaseModel):
    __tablename__ = "areas"

    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name = Column(String(255), nullable=False)
    icon = Column(String(50), nullable=True)
    area_type = Column(
        Enum(AreaType, name="areatype", values_callable=lambda x: [e.value for e in x]),
        default=AreaType.GENERAL,
        nullable=False
    )
    description = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    # Policy fields
    expiry_extension_enabled = Column(Boolean, default=False, nullable=False)
    disable_expiry_tracking = Column(Boolean, default=False, nullable=False)
    warranty_tracking_enabled = Column(Boolean, default=False, nullable=False)
    default_warranty_months = Column(Integer, nullable=True)
    trial_period_enabled = Column(Boolean, default=False, nullable=False)
    default_trial_days = Column(Integer, nullable=True)

    # Relationships
    house = relationship("House")
    items = relationship("DispensaItem", back_populates="area")

    def __repr__(self):
        return f"<Area(id={self.id}, name='{self.name}', type={self.area_type})>"
