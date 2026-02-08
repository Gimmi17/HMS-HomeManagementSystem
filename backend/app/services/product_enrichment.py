"""
Product Enrichment Service

Background service to enrich product data from Open Food Facts.
Runs asynchronously after item verification to not block the UI.

Features:
- Checks local catalog first
- Fetches from Open Food Facts API if not found locally
- Saves to local catalog for future lookups
- Updates shopping list items with product info
- Retry logic for network failures
- Queue-based processing for multiple items
"""

import asyncio
import logging
import threading
import time
from queue import Queue, Empty
from typing import Optional, Callable
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.product_catalog import ProductCatalog
from app.models.product_category_tag import ProductCategoryTag
from app.models.shopping_list import ShoppingListItem
from sqlalchemy import or_
from app.integrations.openfoodfacts import openfoodfacts_client
from app.services.product_nutrition_service import product_nutrition_service

logger = logging.getLogger(__name__)


def get_user_provided_name_for_barcode(db: Session, barcode: str) -> Optional[str]:
    """
    Get the user-provided product name for a barcode from shopping list items.

    When a product is not found in OpenFoodFacts during verification,
    the user may have provided a name (grocy_product_name) during the load check.
    This function retrieves that name to use for uncertified products.
    """
    # Find any shopping list item with this barcode that has a user-provided name
    item = db.query(ShoppingListItem).filter(
        ShoppingListItem.scanned_barcode == barcode,
        ShoppingListItem.grocy_product_name.isnot(None),
        ShoppingListItem.grocy_product_name != ""
    ).order_by(ShoppingListItem.verified_at.desc()).first()

    if item and item.grocy_product_name:
        return item.grocy_product_name

    return None


def parse_and_save_category_tags(db: Session, product: ProductCatalog, categories_str: Optional[str], categories_tags: Optional[list] = None):
    """
    Parse category strings from OpenFoodFacts and create/link ProductCategoryTag entries.

    OpenFoodFacts provides:
    - categories: comma-separated human-readable names (e.g., "Beverages, Sodas")
    - categories_tags: list of tag IDs (e.g., ["en:beverages", "en:sodas"])

    We prefer categories_tags as they are more structured.
    """
    if not categories_tags and not categories_str:
        return

    # Use tags if available, otherwise parse comma-separated string
    if categories_tags:
        tag_ids = categories_tags
    else:
        # Parse comma-separated and create simple tag IDs
        tag_ids = [f"manual:{cat.strip().lower().replace(' ', '-')}" for cat in categories_str.split(',') if cat.strip()]

    for tag_id in tag_ids:
        if not tag_id or not isinstance(tag_id, str):
            continue

        tag_id = tag_id.strip()
        if not tag_id:
            continue

        # Check if tag already exists
        existing_tag = db.query(ProductCategoryTag).filter(ProductCategoryTag.tag_id == tag_id).first()

        if existing_tag:
            # Link to product if not already linked
            if existing_tag not in product.category_tags:
                product.category_tags.append(existing_tag)
        else:
            # Create new tag
            # Parse tag_id format: "lang:category-name" or just "category-name"
            if ':' in tag_id:
                lang, name = tag_id.split(':', 1)
                # Convert tag name to human readable: "carbonated-drinks" -> "Carbonated Drinks"
                human_name = name.replace('-', ' ').title()
            else:
                lang = None
                human_name = tag_id.replace('-', ' ').title()

            new_tag = ProductCategoryTag(
                tag_id=tag_id,
                name=human_name,
                lang=lang
            )
            db.add(new_tag)
            product.category_tags.append(new_tag)

    try:
        db.commit()
        logger.info(f"[Enrichment] Saved {len(product.category_tags)} category tags for product {product.barcode}")
    except Exception as e:
        db.rollback()
        logger.warning(f"[Enrichment] Failed to save category tags for {product.barcode}: {e}")


# Global queue for background processing
_enrichment_queue: Queue = Queue()
_worker_started = False
_worker_lock = threading.Lock()


class EnrichmentTask:
    """Task for the enrichment queue."""
    def __init__(self, barcode: str, item_id: Optional[UUID] = None, list_id: Optional[UUID] = None):
        self.barcode = barcode
        self.item_id = item_id
        self.list_id = list_id
        self.created_at = datetime.now(timezone.utc)
        self.retries = 0
        self.max_retries = 3


async def enrich_product_async(db: Session, barcode: str) -> Optional[ProductCatalog]:
    """
    Enrich product data from Open Food Facts and save to local catalog.

    This function:
    1. Checks if product already exists in local catalog
    2. If not, fetches from Open Food Facts API
    3. Saves the enriched data to local catalog

    Returns the ProductCatalog entry or None if not found.
    """
    # Check if product already exists in catalog
    existing = db.query(ProductCatalog).filter(ProductCatalog.barcode == barcode).first()
    if existing:
        # If existing entry is "not_found" with no name, try to get user-provided name
        if existing.source == "not_found" and not existing.name:
            user_name = get_user_provided_name_for_barcode(db, barcode)
            if user_name:
                existing.name = user_name
                db.commit()
                logger.info(f"[Enrichment] Updated uncertified product {barcode} with user-provided name: {user_name}")

        logger.info(f"[Enrichment] Product {barcode} already in catalog: {existing.name}")
        return existing

    # Fetch from Open Food Facts
    logger.info(f"[Enrichment] Fetching product {barcode} from Open Food Facts...")
    result = await openfoodfacts_client.lookup_barcode(barcode, include_nutrients=True)

    if not result.get("found"):
        logger.info(f"[Enrichment] Product {barcode} not found in Open Food Facts")
        # Try to get user-provided name from shopping list items
        user_name = get_user_provided_name_for_barcode(db, barcode)
        if user_name:
            logger.info(f"[Enrichment] Using user-provided name for {barcode}: {user_name}")

        # Still create a minimal entry so we don't keep searching
        product = ProductCatalog(
            barcode=barcode,
            name=user_name,  # Use user-provided name if available
            source="not_found",
        )
        db.add(product)
        db.commit()
        return None

    # Create catalog entry with all available data
    product = ProductCatalog(
        barcode=barcode,
        name=result.get("product_name"),
        brand=result.get("brand"),
        quantity_text=result.get("quantity"),
        categories=result.get("categories"),
        nutriscore=result.get("nutriscore"),
        ecoscore=result.get("ecoscore"),
        nova_group=result.get("nova_group"),
        image_url=result.get("image_url"),
        image_small_url=result.get("image_small_url"),
        source="openfoodfacts",
        raw_data=result,
    )

    # Extract nutritional data if available
    nutrients = result.get("nutrients", {})
    if nutrients:
        product.energy_kcal = nutrients.get("energy-kcal_100g")
        product.proteins_g = nutrients.get("proteins_100g")
        product.carbs_g = nutrients.get("carbohydrates_100g")
        product.sugars_g = nutrients.get("sugars_100g")
        product.fats_g = nutrients.get("fat_100g")
        product.saturated_fats_g = nutrients.get("saturated-fat_100g")
        product.fiber_g = nutrients.get("fiber_100g")
        product.salt_g = nutrients.get("salt_100g")

    db.add(product)
    db.commit()
    db.refresh(product)

    logger.info(f"[Enrichment] Product {barcode} added to catalog: {product.name} ({product.brand})")

    # Parse and save normalized category tags
    categories_tags = result.get("categories_tags")  # List of tag IDs from OFF
    categories_str = result.get("categories")  # Comma-separated string fallback
    parse_and_save_category_tags(db, product, categories_str, categories_tags)

    # Also fetch detailed nutrition data
    try:
        nutrition = await product_nutrition_service.fetch_and_save_nutrition(
            db=db,
            product_id=product.id,
            barcode=barcode
        )
        if nutrition:
            logger.info(f"[Enrichment] ProductNutrition saved for {barcode}")
        else:
            logger.info(f"[Enrichment] No detailed nutrition data available for {barcode}")
    except Exception as e:
        logger.warning(f"[Enrichment] Failed to save ProductNutrition for {barcode}: {e}")

    return product


def update_shopping_item_with_product(db: Session, item_id: UUID, product: ProductCatalog):
    """
    Update a shopping list item with enriched product data.
    """
    if not product or not product.name:
        return

    item = db.query(ShoppingListItem).filter(ShoppingListItem.id == item_id).first()
    if not item:
        logger.warning(f"[Enrichment] Item {item_id} not found for update")
        return

    # Update item with product name (displayed as "verified with info")
    if not item.grocy_product_name:  # Don't overwrite if already set
        item.grocy_product_name = f"{product.name}" + (f" ({product.brand})" if product.brand else "")
        db.commit()
        logger.info(f"[Enrichment] Updated item {item_id} with product name: {item.grocy_product_name}")


def update_all_items_with_barcode(db: Session, barcode: str, product: ProductCatalog):
    """
    Update ALL shopping list items with the same barcode.

    This is called after product enrichment to retroactively update any items
    (including extra items) that were scanned with this barcode but didn't have
    product info at the time.
    """
    if not product or not product.name:
        return

    product_display_name = f"{product.name}" + (f" ({product.brand})" if product.brand else "")

    # Find all items with this barcode that don't have product name yet
    items = db.query(ShoppingListItem).filter(
        ShoppingListItem.scanned_barcode == barcode,
        ShoppingListItem.grocy_product_name.is_(None)
    ).all()

    updated_count = 0
    for item in items:
        item.grocy_product_name = product_display_name
        # Also update the name if it's still the temporary barcode name
        if item.name.startswith("Prodotto: "):
            item.name = product_display_name
        updated_count += 1

    if updated_count > 0:
        db.commit()
        logger.info(f"[Enrichment] Updated {updated_count} items with barcode {barcode} -> {product_display_name}")


def process_enrichment_task(db_session_factory: Callable, task: EnrichmentTask) -> bool:
    """
    Process a single enrichment task.
    Returns True if successful, False if should retry.
    """
    db = db_session_factory()
    try:
        # Run async function in new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            product = loop.run_until_complete(enrich_product_async(db, task.barcode))

            # Update shopping list item if we have item_id
            if task.item_id and product:
                update_shopping_item_with_product(db, task.item_id, product)

            # Also update ALL other items with same barcode (for extra items and retroactive updates)
            if product and product.name:
                update_all_items_with_barcode(db, task.barcode, product)

            return True

        except Exception as e:
            logger.error(f"[Enrichment] Error processing {task.barcode}: {e}")
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                return False  # Network error, should retry
            return True  # Other error, don't retry

        finally:
            loop.close()

    finally:
        db.close()


def enrichment_worker(db_session_factory: Callable):
    """
    Background worker that processes the enrichment queue.
    Runs continuously in a separate thread.
    """
    logger.info("[Enrichment Worker] Started")

    while True:
        try:
            # Get task from queue with timeout (allows checking for shutdown)
            try:
                task = _enrichment_queue.get(timeout=5)
            except Empty:
                continue

            logger.info(f"[Enrichment Worker] Processing barcode: {task.barcode}")

            success = process_enrichment_task(db_session_factory, task)

            if not success and task.retries < task.max_retries:
                # Retry with exponential backoff
                task.retries += 1
                wait_time = 2 ** task.retries  # 2, 4, 8 seconds
                logger.info(f"[Enrichment Worker] Retry {task.retries}/{task.max_retries} for {task.barcode} in {wait_time}s")
                time.sleep(wait_time)
                _enrichment_queue.put(task)
            else:
                _enrichment_queue.task_done()

        except Exception as e:
            logger.error(f"[Enrichment Worker] Unexpected error: {e}")
            time.sleep(1)  # Prevent tight loop on persistent errors


def start_enrichment_worker(db_session_factory: Callable):
    """
    Start the background enrichment worker if not already running.
    """
    global _worker_started

    with _worker_lock:
        if _worker_started:
            return

        thread = threading.Thread(
            target=enrichment_worker,
            args=(db_session_factory,),
            daemon=True,
            name="ProductEnrichmentWorker"
        )
        thread.start()
        _worker_started = True
        logger.info("[Enrichment] Background worker thread started")


def enrich_product_background(db_session_factory: Callable, barcode: str, item_id: Optional[UUID] = None, list_id: Optional[UUID] = None):
    """
    Queue a product for background enrichment.

    Args:
        db_session_factory: SQLAlchemy session factory
        barcode: Product barcode to enrich
        item_id: Optional shopping list item ID to update with product info
        list_id: Optional shopping list ID (for logging)
    """
    # Ensure worker is running
    start_enrichment_worker(db_session_factory)

    # Add task to queue
    task = EnrichmentTask(barcode=barcode, item_id=item_id, list_id=list_id)
    _enrichment_queue.put(task)
    logger.info(f"[Enrichment] Queued barcode {barcode} for enrichment (queue size: {_enrichment_queue.qsize()})")


def get_queue_status() -> dict:
    """Get current enrichment queue status."""
    return {
        "queue_size": _enrichment_queue.qsize(),
        "worker_running": _worker_started,
    }
