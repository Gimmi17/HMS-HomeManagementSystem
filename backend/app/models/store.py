"""
Store Model
Represents physical stores where shopping is done.
Stores are shared across all houses to enable shared ordering data.
"""

from sqlalchemy import Column, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum

from app.models.base import BaseModel


class StoreSize(str, enum.Enum):
    """Store size classification"""
    S = "S"      # Small
    M = "M"      # Medium
    L = "L"      # Large
    XL = "XL"    # Extra Large
    XXL = "XXL"  # Extra Extra Large


class Store(BaseModel):
    """
    Store Model

    Represents a physical store (supermarket, grocery store, etc.)
    Shared across all houses - anyone can create and use stores.
    """
    __tablename__ = "stores"

    # Chain name (e.g., "Esselunga", "Lidl", "Conad")
    chain = Column(String(255), nullable=True, index=True)

    # Store name (e.g., "Via Roma", "Centro Commerciale")
    name = Column(String(255), nullable=False, index=True)

    # Optional address for identification
    address = Column(String(500), nullable=True)

    # Country (e.g., "Italia", "Svizzera")
    country = Column(String(100), nullable=True)

    # Store size
    size = Column(Enum(StoreSize), nullable=True)

    # Who created this store entry
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    shopping_lists = relationship("ShoppingList", back_populates="store")

    @property
    def display_name(self) -> str:
        """Get full display name including chain"""
        if self.chain:
            return f"{self.chain} - {self.name}"
        return self.name

    def __repr__(self):
        return f"<Store(id={self.id}, chain='{self.chain}', name='{self.name}')>"
