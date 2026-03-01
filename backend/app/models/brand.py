from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class Brand(BaseModel):
    __tablename__ = "brands"

    name = Column(String(255), nullable=False, unique=True, index=True)
    logo_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    cancelled = Column(Boolean, default=False, nullable=False, index=True)

    products = relationship("ProductCatalog", back_populates="brand_entity")
