"""
Grocy API Schemas

Pydantic models for Grocy API request/response data validation.
These schemas define the structure of data exchanged with the Grocy API
and provide type safety throughout the application.

Grocy is an inventory management system that tracks products and stock levels.
"""

from pydantic import BaseModel, Field
from typing import Optional


class GrocyProduct(BaseModel):
    """
    Grocy Product schema (from /api/objects/products).

    Represents a product definition in Grocy, containing all metadata
    about a product that can be stored in inventory.

    Attributes:
        id: Unique product identifier in Grocy
        name: Product display name
        description: Optional product description
        barcode: Optional EAN/UPC barcode for scanning
        qu_id_purchase: Quantity unit ID for purchasing
        qu_id_stock: Quantity unit ID for stock keeping
    """
    id: int = Field(..., description="Grocy product ID")
    name: str = Field(..., description="Product name")
    description: Optional[str] = Field(None, description="Product description")
    barcode: Optional[str] = Field(None, description="EAN/barcode for product scanning")
    qu_id_purchase: Optional[int] = Field(None, description="Purchase quantity unit ID")
    qu_id_stock: Optional[int] = Field(None, description="Stock quantity unit ID")

    class Config:
        """Pydantic configuration"""
        from_attributes = True  # Allow ORM mode (if needed for future DB mapping)
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Milk 1L",
                "description": "Fresh whole milk",
                "barcode": "1234567890123",
                "qu_id_purchase": 5,
                "qu_id_stock": 5
            }
        }


class GrocyStockItem(BaseModel):
    """
    Raw Grocy Stock Item schema (from /api/stock).

    This represents the raw structure returned by Grocy's stock endpoint.
    Contains detailed information about current stock levels.

    Attributes:
        product_id: Reference to product ID
        product_name: Product display name (from nested product object)
        amount: Current quantity in stock
        amount_aggregated: Total quantity across all locations
        best_before_date: Earliest expiration date (ISO format)
    """
    product_id: int = Field(..., description="Grocy product ID")
    product_name: str = Field(..., description="Product name from Grocy")
    amount: float = Field(..., description="Current stock quantity")
    amount_aggregated: float = Field(..., description="Aggregated quantity across locations")
    best_before_date: Optional[str] = Field(None, description="Earliest expiration date (ISO format)")

    class Config:
        """Pydantic configuration"""
        from_attributes = True
        json_schema_extra = {
            "example": {
                "product_id": 1,
                "product_name": "Milk 1L",
                "amount": 2.5,
                "amount_aggregated": 2.5,
                "best_before_date": "2026-01-20"
            }
        }


class GrocyStockResponse(BaseModel):
    """
    Simplified Stock Response schema for frontend consumption.

    This is a simplified, normalized version of Grocy's stock data
    that's easier for the frontend to consume. Flattens nested structures
    and provides consistent field names.

    Attributes:
        product_id: Grocy product identifier
        product_name: Human-readable product name
        quantity: Current stock quantity (simplified from amount)
        unit: Unit of measurement (e.g., "L", "kg", "pz")
        best_before_date: Earliest expiration date (ISO format)

    Usage:
        This schema is used in the GET /grocy/stock endpoint to return
        a clean, simplified list of products in stock.
    """
    product_id: int = Field(..., description="Grocy product ID")
    product_name: str = Field(..., description="Product display name")
    quantity: float = Field(..., description="Current stock quantity")
    unit: str = Field(..., description="Unit of measurement (L, kg, pz, etc)")
    best_before_date: Optional[str] = Field(None, description="Earliest expiration date (ISO format)")

    class Config:
        """Pydantic configuration"""
        from_attributes = True
        json_schema_extra = {
            "example": {
                "product_id": 1,
                "product_name": "Milk 1L",
                "quantity": 2.5,
                "unit": "L",
                "best_before_date": "2026-01-20"
            }
        }
