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
        lookup_barcode_full: Look up a product by barcode with ALL data
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
            fields = "product_name,product_name_it,product_name_en,brands,image_url,image_small_url,quantity,categories,categories_tags,nutriscore_grade,ecoscore_grade,nova_group"
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
                            "categories_tags": product.get("categories_tags"),  # List of tag IDs
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
    async def lookup_barcode_full(barcode: str) -> Dict[str, Any]:
        """
        Look up a product by barcode with ALL available data.

        This method returns the complete product data including all nutritional
        fields, ingredients, allergens, labels, etc.

        Args:
            barcode: The barcode to look up (EAN-13, UPC-A, etc.)

        Returns:
            dict with complete product data or not found response
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{OpenFoodFactsClient.BASE_URL}/product/{barcode}.json",
                    headers={"User-Agent": "MealPlanner/1.0"}
                )

                if response.status_code == 200:
                    data = response.json()

                    if data.get("status") == 1 and data.get("product"):
                        product = data["product"]
                        nutriments = product.get("nutriments", {})

                        result = {
                            "found": True,
                            "barcode": barcode,
                            "raw_response": data,  # Store complete response

                            # Product info
                            "product_name": (
                                product.get("product_name") or
                                product.get("product_name_it") or
                                product.get("product_name_en")
                            ),
                            "brands": product.get("brands"),
                            "quantity": product.get("quantity"),
                            "serving_size": product.get("serving_size"),
                            "categories": product.get("categories"),
                            "ingredients_text": product.get("ingredients_text"),
                            "allergens": product.get("allergens"),
                            "traces": product.get("traces"),
                            "labels": product.get("labels"),
                            "origins": product.get("origins"),
                            "packaging": product.get("packaging"),
                            "image_url": product.get("image_url"),
                            "image_small_url": product.get("image_small_url"),

                            # Scores
                            "nutriscore_grade": product.get("nutriscore_grade"),
                            "ecoscore_grade": product.get("ecoscore_grade"),
                            "nova_group": product.get("nova_group"),
                            "nutrition_score_fr": nutriments.get("nutrition-score-fr_100g"),

                            # Raw nutriments for complete storage
                            "raw_nutriments": nutriments,

                            # Basic nutrients (per 100g)
                            "energy_kcal": nutriments.get("energy-kcal_100g"),
                            "energy_kj": nutriments.get("energy-kj_100g") or nutriments.get("energy_100g"),
                            "fat": nutriments.get("fat_100g"),
                            "saturated_fat": nutriments.get("saturated-fat_100g"),
                            "carbohydrates": nutriments.get("carbohydrates_100g"),
                            "sugars": nutriments.get("sugars_100g"),
                            "added_sugars": nutriments.get("added-sugars_100g"),
                            "starch": nutriments.get("starch_100g"),
                            "fiber": nutriments.get("fiber_100g"),
                            "proteins": nutriments.get("proteins_100g"),
                            "salt": nutriments.get("salt_100g"),
                            "sodium": nutriments.get("sodium_100g"),

                            # Minerals
                            "calcium": nutriments.get("calcium_100g"),
                            "iron": nutriments.get("iron_100g"),
                            "magnesium": nutriments.get("magnesium_100g"),
                            "manganese": nutriments.get("manganese_100g"),
                            "phosphorus": nutriments.get("phosphorus_100g"),
                            "potassium": nutriments.get("potassium_100g"),
                            "copper": nutriments.get("copper_100g"),
                            "selenium": nutriments.get("selenium_100g"),
                            "zinc": nutriments.get("zinc_100g"),

                            # Vitamins
                            "vitamin_a": nutriments.get("vitamin-a_100g"),
                            "vitamin_b1": nutriments.get("vitamin-b1_100g"),
                            "vitamin_b2": nutriments.get("vitamin-b2_100g"),
                            "vitamin_b6": nutriments.get("vitamin-b6_100g"),
                            "vitamin_b9": nutriments.get("vitamin-b9_100g"),
                            "vitamin_b12": nutriments.get("vitamin-b12_100g"),
                            "vitamin_c": nutriments.get("vitamin-c_100g"),
                            "vitamin_d": nutriments.get("vitamin-d_100g"),
                            "vitamin_e": nutriments.get("vitamin-e_100g"),
                            "vitamin_k": nutriments.get("vitamin-k_100g"),

                            # Other
                            "caffeine": nutriments.get("caffeine_100g"),
                            "choline": nutriments.get("choline_100g"),
                            "fruits_vegetables_nuts": nutriments.get("fruits-vegetables-nuts_100g"),
                        }

                        return result
                    else:
                        return OpenFoodFactsClient._not_found_response_full(barcode)
                else:
                    return OpenFoodFactsClient._not_found_response_full(barcode)

        except httpx.ConnectError:
            result = OpenFoodFactsClient._not_found_response_full(barcode)
            result["error"] = "Impossibile raggiungere Open Food Facts"
            return result
        except httpx.TimeoutException:
            result = OpenFoodFactsClient._not_found_response_full(barcode)
            result["error"] = "Timeout connessione"
            return result
        except Exception as e:
            result = OpenFoodFactsClient._not_found_response_full(barcode)
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
            "categories_tags": None,
            "nutriscore": None,
            "ecoscore": None,
            "nova_group": None,
        }

    @staticmethod
    def _not_found_response_full(barcode: str) -> Dict[str, Any]:
        """Helper to create a full not-found response."""
        return {
            "found": False,
            "barcode": barcode,
            "product_name": None,
            "brands": None,
            "raw_response": None,
            "raw_nutriments": None,
        }


# Create singleton instance
openfoodfacts_client = OpenFoodFactsClient()
