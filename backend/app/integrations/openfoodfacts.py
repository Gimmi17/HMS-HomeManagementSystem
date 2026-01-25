"""
Open Food Facts API HTTP Client

This module provides an async HTTP client for interacting with Open Food Facts API.
Open Food Facts is a free, open, collaborative database of food products from around the world.

API Documentation: https://wiki.openfoodfacts.org/API
"""

import httpx
from typing import Dict, Any, Optional


class OpenFoodFactsClient:
    """
    HTTP client for Open Food Facts API integration.

    Open Food Facts is a public database - no API key required.

    Methods:
        lookup_barcode: Look up a product by barcode
    """

    BASE_URL = "https://world.openfoodfacts.org/api/v2"

    @staticmethod
    async def lookup_barcode(barcode: str, include_nutrients: bool = True) -> Dict[str, Any]:
        """
        Look up a product by barcode in Open Food Facts.

        Args:
            barcode: The barcode to look up (EAN-13, UPC-A, etc.)
            include_nutrients: Whether to include nutritional data

        Returns:
            dict with product data including optional nutrients
        """
        try:
            # Build fields list
            fields = "product_name,product_name_it,product_name_en,brands,image_url,image_small_url,quantity,categories,nutriscore_grade,ecoscore_grade,nova_group"
            if include_nutrients:
                fields += ",nutriments"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{OpenFoodFactsClient.BASE_URL}/product/{barcode}",
                    params={"fields": fields},
                    headers={"User-Agent": "MealPlanner/1.0"}
                )

                if response.status_code == 200:
                    data = response.json()

                    if data.get("status") == 1 and data.get("product"):
                        product = data["product"]

                        result = {
                            "found": True,
                            "barcode": barcode,
                            "product_name": product.get("product_name") or product.get("product_name_it") or product.get("product_name_en"),
                            "brand": product.get("brands"),
                            "image_url": product.get("image_url"),
                            "image_small_url": product.get("image_small_url"),
                            "quantity": product.get("quantity"),
                            "categories": product.get("categories"),
                            "nutriscore": product.get("nutriscore_grade"),
                            "ecoscore": product.get("ecoscore_grade"),
                            "nova_group": str(product.get("nova_group")) if product.get("nova_group") else None,
                        }

                        # Include nutrients if requested
                        if include_nutrients and product.get("nutriments"):
                            n = product["nutriments"]
                            result["nutrients"] = {
                                "energy-kcal_100g": n.get("energy-kcal_100g"),
                                "proteins_100g": n.get("proteins_100g"),
                                "carbohydrates_100g": n.get("carbohydrates_100g"),
                                "sugars_100g": n.get("sugars_100g"),
                                "fat_100g": n.get("fat_100g"),
                                "saturated-fat_100g": n.get("saturated-fat_100g"),
                                "fiber_100g": n.get("fiber_100g"),
                                "salt_100g": n.get("salt_100g"),
                            }

                        return result
                    else:
                        return OpenFoodFactsClient._not_found_response(barcode)
                else:
                    return OpenFoodFactsClient._not_found_response(barcode)

        except httpx.ConnectError:
            result = OpenFoodFactsClient._not_found_response(barcode)
            result["error"] = "Impossibile raggiungere Open Food Facts"
            return result
        except httpx.TimeoutException:
            result = OpenFoodFactsClient._not_found_response(barcode)
            result["error"] = "Timeout connessione"
            return result
        except Exception as e:
            result = OpenFoodFactsClient._not_found_response(barcode)
            result["error"] = str(e)
            return result

    @staticmethod
    def _not_found_response(barcode: str) -> Dict[str, Any]:
        """Helper to create a not-found response."""
        return {
            "found": False,
            "barcode": barcode,
            "product_name": None,
            "brand": None,
            "image_url": None,
            "image_small_url": None,
            "quantity": None,
            "categories": None,
            "nutriscore": None,
            "ecoscore": None,
            "nova_group": None,
        }


# Create singleton instance
openfoodfacts_client = OpenFoodFactsClient()
