"""
Grocy API Schemas

Pydantic models for Grocy API request/response data validation.
These schemas define the structure of data exchanged with the Grocy API
and provide type safety throughout the application.

Grocy is an inventory management system that tracks products and stock levels.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


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


# ============================================================================
# Write Operation Request Schemas
# ============================================================================

class GrocyAddStockRequest(BaseModel):
    """
    Request schema for adding stock to a product.

    Attributes:
        amount: Quantity to add (required, positive)
        best_before_date: Expiration date in ISO format (YYYY-MM-DD)
        price: Unit price for this stock entry
        location_id: Storage location ID
        note: Optional note for this entry
    """
    amount: float = Field(..., gt=0, description="Amount to add (must be positive)")
    best_before_date: Optional[str] = Field(None, description="Expiration date (ISO format: YYYY-MM-DD)")
    price: Optional[float] = Field(None, ge=0, description="Unit price")
    location_id: Optional[int] = Field(None, description="Storage location ID")
    note: Optional[str] = Field(None, max_length=500, description="Optional note")

    class Config:
        json_schema_extra = {
            "example": {
                "amount": 2.0,
                "best_before_date": "2026-02-15",
                "price": 1.50,
                "location_id": 1,
                "note": "Bought at discount"
            }
        }


class GrocyConsumeStockRequest(BaseModel):
    """
    Request schema for consuming stock from a product.

    Attributes:
        amount: Quantity to consume (required, positive)
        spoiled: Whether the product was spoiled/wasted
        location_id: Specific location to consume from
    """
    amount: float = Field(..., gt=0, description="Amount to consume (must be positive)")
    spoiled: bool = Field(False, description="Whether the product was spoiled")
    location_id: Optional[int] = Field(None, description="Location to consume from")

    class Config:
        json_schema_extra = {
            "example": {
                "amount": 1.0,
                "spoiled": False,
                "location_id": 1
            }
        }


class GrocyOpenProductRequest(BaseModel):
    """
    Request schema for marking a product as opened.

    Attributes:
        amount: Quantity to mark as opened (defaults to 1)
    """
    amount: float = Field(1.0, gt=0, description="Amount to mark as opened")

    class Config:
        json_schema_extra = {
            "example": {
                "amount": 1.0
            }
        }


class GrocyTransferStockRequest(BaseModel):
    """
    Request schema for transferring stock between locations.

    Attributes:
        amount: Quantity to transfer (required, positive)
        location_id_from: Source location ID
        location_id_to: Destination location ID
    """
    amount: float = Field(..., gt=0, description="Amount to transfer")
    location_id_from: int = Field(..., description="Source location ID")
    location_id_to: int = Field(..., description="Destination location ID")

    class Config:
        json_schema_extra = {
            "example": {
                "amount": 1.0,
                "location_id_from": 1,
                "location_id_to": 2
            }
        }


class GrocyInventoryCorrectionRequest(BaseModel):
    """
    Request schema for inventory correction.

    Sets the absolute stock amount, regardless of current stock.

    Attributes:
        new_amount: New absolute stock amount (required, non-negative)
        best_before_date: Expiration date for the stock
        location_id: Location for the stock
    """
    new_amount: float = Field(..., ge=0, description="New absolute stock amount")
    best_before_date: Optional[str] = Field(None, description="Expiration date (ISO format)")
    location_id: Optional[int] = Field(None, description="Location ID")

    class Config:
        json_schema_extra = {
            "example": {
                "new_amount": 5.0,
                "best_before_date": "2026-03-01",
                "location_id": 1
            }
        }


class GrocyBulkAddItem(BaseModel):
    """
    Single item for bulk stock addition.

    Attributes:
        product_id: Grocy product ID
        amount: Quantity to add
        best_before_date: Expiration date
        price: Unit price
        location_id: Storage location
        note: Optional note
    """
    product_id: int = Field(..., description="Grocy product ID")
    amount: float = Field(..., gt=0, description="Amount to add")
    best_before_date: Optional[str] = Field(None, description="Expiration date")
    price: Optional[float] = Field(None, ge=0, description="Unit price")
    location_id: Optional[int] = Field(None, description="Storage location")
    note: Optional[str] = Field(None, description="Optional note")


class GrocyBulkAddStockRequest(BaseModel):
    """
    Request schema for bulk stock addition.

    Used to add multiple products at once (e.g., from shopping list).

    Attributes:
        items: List of items to add to stock
    """
    items: List[GrocyBulkAddItem] = Field(..., min_length=1, description="Items to add")

    class Config:
        json_schema_extra = {
            "example": {
                "items": [
                    {"product_id": 1, "amount": 2.0, "best_before_date": "2026-02-15"},
                    {"product_id": 2, "amount": 1.0, "best_before_date": "2026-03-01"}
                ]
            }
        }


# ============================================================================
# Write Operation Response Schemas
# ============================================================================

class GrocyWriteOperationResponse(BaseModel):
    """
    Response schema for write operations.

    Attributes:
        success: Whether the operation succeeded
        message: Human-readable result message
        error: Error details if operation failed
    """
    success: bool = Field(..., description="Whether operation succeeded")
    message: str = Field(..., description="Result message")
    error: Optional[str] = Field(None, description="Error details if failed")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Stock aggiunto con successo",
                "error": None
            }
        }


class GrocyBulkAddResult(BaseModel):
    """
    Result for a single item in bulk add operation.

    Attributes:
        product_id: Grocy product ID
        success: Whether this item was added successfully
        message: Result message
    """
    product_id: int = Field(..., description="Product ID")
    success: bool = Field(..., description="Whether addition succeeded")
    message: str = Field(..., description="Result message")


class GrocyBulkAddStockResponse(BaseModel):
    """
    Response schema for bulk stock addition.

    Attributes:
        total: Total items processed
        successful: Number of successful additions
        failed: Number of failed additions
        results: Individual results for each item
    """
    total: int = Field(..., description="Total items processed")
    successful: int = Field(..., description="Successful additions")
    failed: int = Field(..., description="Failed additions")
    results: List[GrocyBulkAddResult] = Field(..., description="Individual results")

    class Config:
        json_schema_extra = {
            "example": {
                "total": 2,
                "successful": 2,
                "failed": 0,
                "results": [
                    {"product_id": 1, "success": True, "message": "Aggiunto 2.0 unità"},
                    {"product_id": 2, "success": True, "message": "Aggiunto 1.0 unità"}
                ]
            }
        }


# ============================================================================
# Location Schema
# ============================================================================

class GrocyLocation(BaseModel):
    """
    Grocy location schema.

    Attributes:
        id: Location ID
        name: Location name
        description: Location description
        is_freezer: Whether this is a freezer location
    """
    id: int = Field(..., description="Location ID")
    name: str = Field(..., description="Location name")
    description: Optional[str] = Field(None, description="Location description")
    is_freezer: bool = Field(False, description="Whether this is a freezer")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Frigorifero",
                "description": "Frigorifero principale in cucina",
                "is_freezer": False
            }
        }
