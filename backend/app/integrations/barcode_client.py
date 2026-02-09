"""
Generic Barcode Lookup Client

A generic async HTTP client for Open*Facts-compatible APIs.
Works with any source that uses the same response format as OpenFoodFacts.
"""

import httpx
from typing import Dict, Any


def parse_off_response(data: dict, barcode: str) -> Dict[str, Any]:
    """
    Parse a response from an Open*Facts-compatible API.
    Shared parsing logic for OpenFoodFacts, OpenProductsFacts, OpenBeautyFacts, etc.
    """
    if data.get("status") == 1 and data.get("product"):
        product = data["product"]

        result = {
            "found": True,
            "barcode": barcode,
            "product_name": (
                product.get("product_name")
                or product.get("product_name_it")
                or product.get("product_name_en")
            ),
            "brand": product.get("brands"),
            "image_url": product.get("image_url"),
            "image_small_url": product.get("image_small_url"),
            "quantity": product.get("quantity"),
            "categories": product.get("categories"),
            "categories_tags": product.get("categories_tags"),
            "nutriscore": product.get("nutriscore_grade"),
            "ecoscore": product.get("ecoscore_grade"),
            "nova_group": str(product.get("nova_group")) if product.get("nova_group") else None,
        }

        # Include nutrients if available
        if product.get("nutriments"):
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


class GenericBarcodeClient:
    """
    Generic HTTP client for Open*Facts-compatible barcode APIs.
    """

    @staticmethod
    async def lookup(base_url: str, api_path: str, barcode: str) -> Dict[str, Any]:
        """
        Lookup barcode using a generic Open*Facts-compatible API.
        api_path must contain {barcode} as placeholder.
        Returns dict with found, barcode, product_name, brand, etc.
        """
        try:
            url = base_url.rstrip("/") + api_path.format(barcode=barcode)

            fields = "product_name,product_name_it,product_name_en,brands,image_url,image_small_url,quantity,categories,categories_tags,nutriscore_grade,ecoscore_grade,nova_group,nutriments"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    url,
                    params={"fields": fields},
                    headers={"User-Agent": "MealPlanner/1.0"}
                )

                if response.status_code == 200:
                    data = response.json()
                    return parse_off_response(data, barcode)
                else:
                    return parse_off_response({}, barcode)

        except httpx.ConnectError:
            result = parse_off_response({}, barcode)
            result["error"] = "Impossibile raggiungere il server"
            return result
        except httpx.TimeoutException:
            result = parse_off_response({}, barcode)
            result["error"] = "Timeout connessione"
            return result
        except Exception as e:
            result = parse_off_response({}, barcode)
            result["error"] = str(e)
            return result
