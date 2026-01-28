"""
Grocy API HTTP Client

This module provides an async HTTP client for interacting with Grocy API.
Grocy is an open-source inventory management system that tracks products,
stock levels, and expiration dates.

API Documentation: https://demo.grocy.info/api

Features:
- Async HTTP requests using httpx
- Automatic authentication via API key header
- Timeout protection (10 seconds)
- Graceful degradation if Grocy is not configured
- Write operations: add, consume, open, transfer, inventory
"""

import httpx
from typing import List, Dict, Any, Optional
from datetime import date
from app.core.config import settings


class GrocyAPIError(Exception):
    """Exception raised when Grocy API returns an error."""
    def __init__(self, message: str, status_code: int = None, details: Any = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class GrocyClient:
    """
    HTTP client for Grocy API integration.

    This client handles all communication with the Grocy instance, including:
    - Fetching current stock levels
    - Retrieving product information
    - Reading product details by ID

    The client is designed to fail gracefully if Grocy is not configured,
    returning empty lists instead of raising errors.

    Attributes:
        base_url (str): Grocy instance base URL (from settings)
        api_key (str): Grocy API key for authentication (from settings)
    """

    def __init__(self):
        """
        Initialize Grocy client with configuration from settings.

        Configuration is loaded from environment variables:
        - GROCY_URL: Base URL of Grocy instance
        - GROCY_API_KEY: API key for authentication
        """
        self.base_url = settings.GROCY_URL
        self.api_key = settings.GROCY_API_KEY

    @property
    def headers(self) -> Dict[str, str]:
        """
        Generate HTTP headers for Grocy API requests.

        Returns:
            dict: Headers including API key authentication and content type

        Note:
            Grocy uses a custom header "GROCY-API-KEY" for authentication
            instead of standard Authorization header.
        """
        return {
            "GROCY-API-KEY": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def get_stock(self) -> List[Dict[str, Any]]:
        """
        Fetch current stock levels from Grocy.

        This endpoint returns all products currently in stock with their quantities,
        units, and expiration dates.

        Returns:
            list: List of stock items, each containing:
                - product_id (int): Product ID
                - product (dict): Product details (name, etc)
                - amount (float): Current quantity
                - amount_aggregated (float): Total quantity across all locations
                - best_before_date (str): Earliest expiration date
                - qu_unit_stock (dict): Stock unit information

        Returns empty list if:
            - GROCY_URL is not configured
            - Grocy instance is unreachable
            - API returns an error

        Example response from Grocy:
            [
                {
                    "product_id": 1,
                    "product": {"name": "Milk"},
                    "amount": "2.5",
                    "amount_aggregated": "2.5",
                    "best_before_date": "2026-01-20",
                    "qu_unit_stock": {"name": "L"}
                }
            ]
        """
        # Return empty list if Grocy is not configured (graceful degradation)
        if not self.base_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/stock",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            # Log error but don't crash (allow app to work without Grocy)
            print(f"Grocy API error (get_stock): {e}")
            return []
        except Exception as e:
            print(f"Unexpected error calling Grocy (get_stock): {e}")
            return []

    async def get_products(self) -> List[Dict[str, Any]]:
        """
        Fetch all products from Grocy database.

        This endpoint returns all products defined in Grocy, regardless of whether
        they are currently in stock. Useful for browsing the product catalog.

        Returns:
            list: List of products, each containing:
                - id (int): Product ID
                - name (str): Product name
                - description (str): Product description
                - barcode (str): EAN/barcode
                - qu_id_purchase (int): Purchase quantity unit ID
                - qu_id_stock (int): Stock quantity unit ID
                - location_id (int): Default location
                - min_stock_amount (int): Minimum stock level

        Returns empty list if:
            - GROCY_URL is not configured
            - Grocy instance is unreachable
            - API returns an error

        Example response from Grocy:
            [
                {
                    "id": 1,
                    "name": "Milk",
                    "description": "Fresh milk 1L",
                    "barcode": "1234567890123",
                    "qu_id_stock": 5
                }
            ]
        """
        # Return empty list if Grocy is not configured
        if not self.base_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/objects/products",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            print(f"Grocy API error (get_products): {e}")
            return []
        except Exception as e:
            print(f"Unexpected error calling Grocy (get_products): {e}")
            return []

    async def get_product(self, product_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch detailed information for a specific product.

        Args:
            product_id (int): Grocy product ID

        Returns:
            dict: Product details including:
                - id (int): Product ID
                - name (str): Product name
                - description (str): Description
                - barcode (str): EAN/barcode
                - All other product metadata

            None if product not found or error occurs

        Raises:
            HTTPException: If Grocy is not configured or unreachable
                (handled at endpoint level, not here)

        Example response from Grocy:
            {
                "id": 1,
                "name": "Milk",
                "description": "Fresh milk 1L",
                "barcode": "1234567890123",
                "qu_id_stock": 5,
                "location_id": 2
            }
        """
        if not self.base_url:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/objects/products/{product_id}",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            print(f"Grocy API error (get_product {product_id}): {e}")
            return None
        except Exception as e:
            print(f"Unexpected error calling Grocy (get_product {product_id}): {e}")
            return None

    async def get_locations(self) -> List[Dict[str, Any]]:
        """
        Fetch all locations from Grocy.

        Returns:
            list: List of locations, each containing:
                - id (int): Location ID
                - name (str): Location name
                - description (str): Location description
                - is_freezer (bool): Whether this is a freezer location

        Returns empty list if Grocy is not configured or on error.
        """
        if not self.base_url:
            return []

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/api/objects/locations",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            print(f"Grocy API error (get_locations): {e}")
            return []
        except Exception as e:
            print(f"Unexpected error calling Grocy (get_locations): {e}")
            return []

    async def add_stock(
        self,
        product_id: int,
        amount: float,
        best_before_date: Optional[str] = None,
        price: Optional[float] = None,
        location_id: Optional[int] = None,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add stock to a product in Grocy.

        Args:
            product_id: Grocy product ID
            amount: Amount to add (in stock units)
            best_before_date: Expiration date (ISO format YYYY-MM-DD), defaults to "2999-12-31"
            price: Unit price for this stock entry
            location_id: Location ID where stock will be stored
            note: Optional note for this stock entry

        Returns:
            dict: Grocy API response with transaction details

        Raises:
            GrocyAPIError: If the API returns an error
        """
        if not self.base_url:
            raise GrocyAPIError("Grocy not configured", status_code=503)

        payload = {
            "amount": amount,
            "best_before_date": best_before_date or "2999-12-31",
            "transaction_type": "purchase"
        }
        if price is not None:
            payload["price"] = price
        if location_id is not None:
            payload["location_id"] = location_id
        if note:
            payload["note"] = note

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/stock/products/{product_id}/add",
                    headers=self.headers,
                    json=payload
                )
                if response.status_code >= 400:
                    error_detail = response.text
                    try:
                        error_detail = response.json()
                    except:
                        pass
                    raise GrocyAPIError(
                        f"Failed to add stock: {response.status_code}",
                        status_code=response.status_code,
                        details=error_detail
                    )
                return response.json() if response.text else {"success": True}
        except httpx.HTTPError as e:
            raise GrocyAPIError(f"HTTP error adding stock: {e}", status_code=503)
        except GrocyAPIError:
            raise
        except Exception as e:
            raise GrocyAPIError(f"Unexpected error adding stock: {e}", status_code=500)

    async def consume_stock(
        self,
        product_id: int,
        amount: float,
        spoiled: bool = False,
        location_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Consume stock from a product in Grocy.

        Args:
            product_id: Grocy product ID
            amount: Amount to consume (in stock units)
            spoiled: Whether the product was spoiled/wasted
            location_id: Specific location to consume from

        Returns:
            dict: Grocy API response with transaction details

        Raises:
            GrocyAPIError: If the API returns an error
        """
        if not self.base_url:
            raise GrocyAPIError("Grocy not configured", status_code=503)

        payload = {
            "amount": amount,
            "spoiled": spoiled,
            "transaction_type": "consume"
        }
        if location_id is not None:
            payload["location_id"] = location_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/stock/products/{product_id}/consume",
                    headers=self.headers,
                    json=payload
                )
                if response.status_code >= 400:
                    error_detail = response.text
                    try:
                        error_detail = response.json()
                    except:
                        pass
                    raise GrocyAPIError(
                        f"Failed to consume stock: {response.status_code}",
                        status_code=response.status_code,
                        details=error_detail
                    )
                return response.json() if response.text else {"success": True}
        except httpx.HTTPError as e:
            raise GrocyAPIError(f"HTTP error consuming stock: {e}", status_code=503)
        except GrocyAPIError:
            raise
        except Exception as e:
            raise GrocyAPIError(f"Unexpected error consuming stock: {e}", status_code=500)

    async def open_product(
        self,
        product_id: int,
        amount: float = 1.0
    ) -> Dict[str, Any]:
        """
        Mark a product as opened in Grocy.

        Args:
            product_id: Grocy product ID
            amount: Amount to mark as opened (defaults to 1)

        Returns:
            dict: Grocy API response with transaction details

        Raises:
            GrocyAPIError: If the API returns an error
        """
        if not self.base_url:
            raise GrocyAPIError("Grocy not configured", status_code=503)

        payload = {
            "amount": amount
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/stock/products/{product_id}/open",
                    headers=self.headers,
                    json=payload
                )
                if response.status_code >= 400:
                    error_detail = response.text
                    try:
                        error_detail = response.json()
                    except:
                        pass
                    raise GrocyAPIError(
                        f"Failed to open product: {response.status_code}",
                        status_code=response.status_code,
                        details=error_detail
                    )
                return response.json() if response.text else {"success": True}
        except httpx.HTTPError as e:
            raise GrocyAPIError(f"HTTP error opening product: {e}", status_code=503)
        except GrocyAPIError:
            raise
        except Exception as e:
            raise GrocyAPIError(f"Unexpected error opening product: {e}", status_code=500)

    async def transfer_stock(
        self,
        product_id: int,
        amount: float,
        location_id_from: int,
        location_id_to: int
    ) -> Dict[str, Any]:
        """
        Transfer stock between locations in Grocy.

        Args:
            product_id: Grocy product ID
            amount: Amount to transfer
            location_id_from: Source location ID
            location_id_to: Destination location ID

        Returns:
            dict: Grocy API response with transaction details

        Raises:
            GrocyAPIError: If the API returns an error
        """
        if not self.base_url:
            raise GrocyAPIError("Grocy not configured", status_code=503)

        payload = {
            "amount": amount,
            "location_id_from": location_id_from,
            "location_id_to": location_id_to
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/stock/products/{product_id}/transfer",
                    headers=self.headers,
                    json=payload
                )
                if response.status_code >= 400:
                    error_detail = response.text
                    try:
                        error_detail = response.json()
                    except:
                        pass
                    raise GrocyAPIError(
                        f"Failed to transfer stock: {response.status_code}",
                        status_code=response.status_code,
                        details=error_detail
                    )
                return response.json() if response.text else {"success": True}
        except httpx.HTTPError as e:
            raise GrocyAPIError(f"HTTP error transferring stock: {e}", status_code=503)
        except GrocyAPIError:
            raise
        except Exception as e:
            raise GrocyAPIError(f"Unexpected error transferring stock: {e}", status_code=500)

    async def inventory_correction(
        self,
        product_id: int,
        new_amount: float,
        best_before_date: Optional[str] = None,
        location_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Perform inventory correction for a product in Grocy.

        This sets the absolute stock amount, regardless of current stock.

        Args:
            product_id: Grocy product ID
            new_amount: New absolute stock amount
            best_before_date: Expiration date for the stock (ISO format)
            location_id: Location ID for the stock

        Returns:
            dict: Grocy API response with transaction details

        Raises:
            GrocyAPIError: If the API returns an error
        """
        if not self.base_url:
            raise GrocyAPIError("Grocy not configured", status_code=503)

        payload = {
            "new_amount": new_amount
        }
        if best_before_date:
            payload["best_before_date"] = best_before_date
        if location_id is not None:
            payload["location_id"] = location_id

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/stock/products/{product_id}/inventory",
                    headers=self.headers,
                    json=payload
                )
                if response.status_code >= 400:
                    error_detail = response.text
                    try:
                        error_detail = response.json()
                    except:
                        pass
                    raise GrocyAPIError(
                        f"Failed to correct inventory: {response.status_code}",
                        status_code=response.status_code,
                        details=error_detail
                    )
                return response.json() if response.text else {"success": True}
        except httpx.HTTPError as e:
            raise GrocyAPIError(f"HTTP error correcting inventory: {e}", status_code=503)
        except GrocyAPIError:
            raise
        except Exception as e:
            raise GrocyAPIError(f"Unexpected error correcting inventory: {e}", status_code=500)


# Global singleton instance
# This instance is imported throughout the application
grocy_client = GrocyClient()
