"""
ProductBarcode Model
Separate table for product barcodes supporting N barcodes per product.
"""

from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class ProductBarcode(BaseModel):
    __tablename__ = "product_barcodes"

    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_catalog.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    barcode = Column(String(100), nullable=False, unique=True, index=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    source = Column(String(50), nullable=True)  # openfoodfacts, manual, grocy

    product = relationship("ProductCatalog", back_populates="barcodes")

    def __repr__(self):
        return f"<ProductBarcode(barcode={self.barcode}, product_id={self.product_id}, primary={self.is_primary})>"
