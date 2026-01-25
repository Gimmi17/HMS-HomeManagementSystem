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
"""

import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings


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


# Global singleton instance
# This instance is imported throughout the application
grocy_client = GrocyClient()
