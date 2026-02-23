"""
Environment Model
Manages environments (locations) within a house for organizing items.

Examples: Dispensa, Frigorifero, Congelatore, Borsa Attrezzi, Garage, etc.
"""

import enum
from sqlalchemy import Column, String, ForeignKey, Boolean, Integer, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class EnvironmentType(str, enum.Enum):
    FOOD_STORAGE = "food_storage"
    EQUIPMENT = "equipment"
    GENERAL = "general"


class Environment(BaseModel):
    __tablename__ = "environments"

    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name = Column(String(255), nullable=False)
    icon = Column(String(50), nullable=True)
    env_type = Column(
        Enum(EnvironmentType, name="environmenttype", values_callable=lambda x: [e.value for e in x]),
        default=EnvironmentType.GENERAL,
        nullable=False
    )
    description = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    # Relationships
    house = relationship("House")
    items = relationship("DispensaItem", back_populates="environment")

    def __repr__(self):
        return f"<Environment(id={self.id}, name='{self.name}', type={self.env_type})>"
