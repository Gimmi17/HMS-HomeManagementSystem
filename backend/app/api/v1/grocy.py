"""
Grocy Integration API Endpoints

This module provides proxy endpoints for Grocy API integration.
Acts as a middleware layer between the frontend and Grocy instance,
providing simplified data structures and error handling.

Endpoints:
- GET /grocy/stock - List all products in stock with quantities
- GET /grocy/products - List all products in Grocy database
- GET /grocy/products/{product_id} - Get detailed product information

Authentication: All endpoints require valid JWT token (future implementation)
Authorization: Users must belong to a house (future implementation)
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID
import httpx
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.house import House
from app.integrations.grocy import grocy_client
from app.schemas.grocy import GrocyStockResponse


class GrocyTestConnectionRequest(BaseModel):
    """Request body for testing Grocy connection."""
    grocy_url: str
    grocy_api_key: str


class GrocyTestConnectionResponse(BaseModel):
    """Response for Grocy connection test."""
    success: bool
    message: str
    grocy_version: str | None = None


# Create router with prefix and tags
# Prefix /grocy will be added by the main router
router = APIRouter(prefix="/grocy", tags=["Grocy Integration"])


@router.post(
    "/test-connection",
    response_model=GrocyTestConnectionResponse,
    summary="Test Grocy Connection",
    description="""
    Test connection to a Grocy server with provided credentials.

    This endpoint is used by the settings page to verify that the Grocy URL
    and API key are valid before saving them.

    **Request Body:**
    - grocy_url: Full URL to the Grocy server (e.g., http://192.168.1.100:9283)
    - grocy_api_key: Valid Grocy API key

    **Response:**
    - success: Whether the connection was successful
    - message: Human-readable result message
    - grocy_version: Grocy version if connection successful
    """
)
async def test_grocy_connection(request: GrocyTestConnectionRequest):
    """
    Test connection to Grocy server.

    Makes a request to Grocy's system info endpoint to verify credentials.
    """
    grocy_url = request.grocy_url.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{grocy_url}/api/system/info",
                headers={
                    "GROCY-API-KEY": request.grocy_api_key,
                    "Accept": "application/json"
                }
            )

            if response.status_code == 200:
                data = response.json()
                version = data.get("grocy_version", {}).get("Version", "unknown")
                return GrocyTestConnectionResponse(
                    success=True,
                    message=f"Connessione riuscita! Grocy versione {version}",
                    grocy_version=version
                )
            elif response.status_code == 401:
                return GrocyTestConnectionResponse(
                    success=False,
                    message="API Key non valida. Verifica la chiave e riprova."
                )
            else:
                return GrocyTestConnectionResponse(
                    success=False,
                    message=f"Errore di connessione: {response.status_code} {response.reason_phrase}"
                )
    except httpx.ConnectError:
        return GrocyTestConnectionResponse(
            success=False,
            message="Impossibile raggiungere il server. Verifica l'URL e che il server sia raggiungibile."
        )
    except httpx.TimeoutException:
        return GrocyTestConnectionResponse(
            success=False,
            message="Timeout connessione. Il server non risponde."
        )
    except Exception as e:
        return GrocyTestConnectionResponse(
            success=False,
            message=f"Errore: {str(e)}"
        )


@router.get(
    "/stock",
    response_model=List[GrocyStockResponse],
    summary="Get Current Stock",
    description="""
    Fetch current stock levels from Grocy inventory system.

    Returns a simplified list of all products currently in stock,
    including quantities, units, and expiration dates.

    **Graceful Degradation:**
    - Returns empty list if Grocy is not configured (GROCY_URL not set)
    - Returns HTTP 503 if Grocy is configured but unreachable

    **Response Fields:**
    - product_id: Grocy product identifier
    - product_name: Human-readable product name
    - quantity: Current stock quantity
    - unit: Unit of measurement (L, kg, pz, etc)
    - best_before_date: Earliest expiration date (ISO format)

    **Use Cases:**
    - Display pantry inventory in frontend
    - Suggest recipes based on available ingredients
    - Show expiration warnings for products
    """,
    responses={
        200: {
            "description": "Stock list successfully retrieved",
            "content": {
                "application/json": {
                    "example": [
                        {
                            "product_id": 1,
                            "product_name": "Milk 1L",
                            "quantity": 2.5,
                            "unit": "L",
                            "best_before_date": "2026-01-20"
                        },
                        {
                            "product_id": 2,
                            "product_name": "Pasta",
                            "quantity": 1.0,
                            "unit": "kg",
                            "best_before_date": "2026-12-31"
                        }
                    ]
                }
            }
        },
        503: {
            "description": "Grocy service unavailable",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Grocy non raggiungibile: Connection timeout"
                    }
                }
            }
        }
    }
)
async def get_stock():
    """
    Retrieve current stock from Grocy.

    This endpoint proxies the Grocy /api/stock endpoint and transforms
    the response into a simplified format for frontend consumption.

    Returns:
        List[GrocyStockResponse]: List of products in stock

    Raises:
        HTTPException 503: If Grocy is configured but unreachable

    Implementation Notes:
        - Extracts nested product name from Grocy's response structure
        - Provides default values for missing fields (e.g., unit defaults to "pz")
        - Handles malformed Grocy responses gracefully
    """
    try:
        # Call Grocy API to get stock
        stock = await grocy_client.get_stock()

        # Transform Grocy's nested response into simplified format
        # Grocy returns: [{product_id, product: {name}, amount, qu_unit_stock: {name}, best_before_date}]
        # We transform to: [{product_id, product_name, quantity, unit, best_before_date}]
        simplified_stock = []
        for item in stock:
            # Extract product name from nested structure
            product_data = item.get("product", {})
            product_name = product_data.get("name", "Unknown Product")

            # Extract unit from nested structure (default to "pz" if missing)
            qu_unit_data = item.get("qu_unit_stock", {})
            unit = qu_unit_data.get("name", "pz")

            # Build simplified response
            simplified_item = {
                "product_id": item.get("product_id"),
                "product_name": product_name,
                "quantity": item.get("amount", 0),
                "unit": unit,
                "best_before_date": item.get("best_before_date")
            }
            simplified_stock.append(simplified_item)

        return simplified_stock

    except Exception as e:
        # Raise HTTP 503 if any error occurs communicating with Grocy
        # This includes network errors, timeouts, malformed responses, etc.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Grocy non raggiungibile: {str(e)}"
        )


@router.get(
    "/products",
    summary="Get All Products",
    description="""
    Fetch all products from Grocy database.

    Returns complete list of products defined in Grocy, regardless of
    whether they are currently in stock. Useful for browsing the product catalog.

    **Graceful Degradation:**
    - Returns empty list if Grocy is not configured
    - Returns HTTP 503 if Grocy is configured but unreachable

    **Response Structure:**
    Returns raw Grocy product objects including:
    - id: Product ID
    - name: Product name
    - description: Product description
    - barcode: EAN/barcode
    - qu_id_stock: Stock quantity unit ID
    - location_id: Default storage location

    **Use Cases:**
    - Display full product catalog
    - Product search and autocomplete
    - Map Grocy products to nutritional database (future)
    """,
    responses={
        200: {
            "description": "Product list successfully retrieved",
        },
        503: {
            "description": "Grocy service unavailable"
        }
    }
)
async def get_products():
    """
    Retrieve all products from Grocy.

    Returns the raw product list from Grocy's /api/objects/products endpoint.
    No transformation is applied to maintain full product metadata.

    Returns:
        list: Raw list of Grocy products

    Raises:
        HTTPException 503: If Grocy is configured but unreachable
    """
    try:
        products = await grocy_client.get_products()
        return products
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Grocy non raggiungibile: {str(e)}"
        )


@router.get(
    "/products/{product_id}",
    summary="Get Product Details",
    description="""
    Fetch detailed information for a specific product.

    **Path Parameters:**
    - product_id: Grocy product identifier (integer)

    **Response:**
    Returns complete product details including metadata, units, and location.

    **Use Cases:**
    - Display detailed product information
    - View product barcode and description
    - Check default storage location
    """,
    responses={
        200: {
            "description": "Product details successfully retrieved"
        },
        404: {
            "description": "Product not found in Grocy"
        },
        503: {
            "description": "Grocy service unavailable"
        }
    }
)
async def get_product(product_id: int):
    """
    Retrieve detailed product information.

    Args:
        product_id (int): Grocy product identifier

    Returns:
        dict: Complete product details from Grocy

    Raises:
        HTTPException 404: If product not found
        HTTPException 503: If Grocy is configured but unreachable
    """
    try:
        product = await grocy_client.get_product(product_id)

        # If product not found, raise 404
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prodotto {product_id} non trovato in Grocy"
            )

        return product
    except HTTPException:
        # Re-raise HTTPExceptions (404) without modification
        raise
    except Exception as e:
        # Other errors are considered service unavailable
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Grocy non raggiungibile: {str(e)}"
        )


# House-based Grocy endpoints (use settings from house.settings)

class GrocyProductSimple(BaseModel):
    """Simplified Grocy product for shopping list selection."""
    id: int
    name: str
    description: Optional[str] = None
    barcode: Optional[str] = None


def get_house_grocy_settings(db: Session, house_id: UUID) -> tuple[str, str]:
    """
    Get Grocy settings from house.

    Args:
        db: Database session
        house_id: House UUID

    Returns:
        tuple: (grocy_url, grocy_api_key)

    Raises:
        HTTPException 404: If house not found
        HTTPException 400: If Grocy not configured
    """
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Casa non trovata"
        )

    settings = house.settings or {}
    grocy_url = settings.get("grocy_url", "")
    grocy_api_key = settings.get("grocy_api_key", "")

    if not grocy_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grocy non configurato per questa casa. Vai su Impostazioni > Grocy."
        )

    return grocy_url, grocy_api_key


@router.get(
    "/house-products",
    response_model=List[GrocyProductSimple],
    summary="Get Products from House Grocy",
    description="""
    Fetch products from the Grocy instance configured for a specific house.

    Uses the grocy_url and grocy_api_key stored in house.settings.
    Used by the shopping list product selector.
    """
)
async def get_house_products(
    house_id: UUID = Query(..., description="House ID"),
    search: Optional[str] = Query(None, description="Search query to filter products"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch products from house-configured Grocy instance."""
    grocy_url, grocy_api_key = get_house_grocy_settings(db, house_id)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{grocy_url}/api/objects/products",
                headers={
                    "GROCY-API-KEY": grocy_api_key,
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            products = response.json()

            # Simplify and optionally filter products
            result = []
            for p in products:
                # Apply search filter if provided
                if search:
                    name = p.get("name", "").lower()
                    if search.lower() not in name:
                        continue

                result.append(GrocyProductSimple(
                    id=p.get("id"),
                    name=p.get("name", ""),
                    description=p.get("description"),
                    barcode=p.get("barcode")
                ))

            return result

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API Key Grocy non valida"
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Errore Grocy: {e.response.status_code}"
        )
    except httpx.ConnectError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Impossibile raggiungere il server Grocy"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Errore: {str(e)}"
        )
