from sqlalchemy import Column, ForeignKey, String, Date, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class BiometricProfile(BaseModel):
    __tablename__ = "biometric_profiles"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    house_id = Column(
        UUID(as_uuid=True),
        ForeignKey("houses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    birth_date = Column(Date, nullable=True)
    biological_sex = Column(String(10), nullable=True)
    height_cm = Column(Numeric(5, 1), nullable=True)
    activity_level = Column(String(20), nullable=True)  # sedentary/light/moderate/active/very_active
    goal = Column(String(30), nullable=True)  # lose_fat/maintain/gain_muscle/performance
    diet_type = Column(String(30), nullable=True)  # iperproteica/ipocalorica/mediterranea/chetogenica
    target_weight_kg = Column(Numeric(5, 2), nullable=True)
    target_kcal = Column(Numeric(7, 1), nullable=True)
    target_protein_g = Column(Numeric(6, 1), nullable=True)
    target_carbs_g = Column(Numeric(6, 1), nullable=True)
    target_fat_g = Column(Numeric(6, 1), nullable=True)
    notes = Column(Text, nullable=True)
