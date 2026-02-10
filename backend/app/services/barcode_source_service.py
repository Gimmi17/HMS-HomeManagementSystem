"""
Barcode Source Service

Manages barcode lookup sources and the fallback chain.
Seeds hardcoded sources at startup, provides chain lookup across all active sources.
"""

import logging

from sqlalchemy.orm import Session

from app.models.barcode_source import BarcodeLookupSource
from app.integrations.barcode_client import GenericBarcodeClient

logger = logging.getLogger(__name__)


HARDCODED_SOURCES = [
    {
        "code": "openfoodfacts",
        "name": "Open Food Facts",
        "base_url": "https://world.openfoodfacts.org",
        "api_path": "/api/v2/product/{barcode}",
        "sort_order": 1,
        "description": "Database mondiale prodotti alimentari",
    },
    {
        "code": "openproductsfacts",
        "name": "Open Products Facts",
        "base_url": "https://world.openproductsfacts.org",
        "api_path": "/api/v2/product/{barcode}",
        "sort_order": 2,
        "description": "Database prodotti non alimentari (detersivi, ecc.)",
    },
    {
        "code": "openbeautyfacts",
        "name": "Open Beauty Facts",
        "base_url": "https://world.openbeautyfacts.org",
        "api_path": "/api/v2/product/{barcode}",
        "sort_order": 3,
        "description": "Database prodotti cosmetici e cura persona",
    },
]


def seed_hardcoded_sources(db: Session):
    """
    Seed hardcoded barcode lookup sources if not already present.
    Called at startup after create_all().
    """
    added = 0
    for source_data in HARDCODED_SOURCES:
        existing = db.query(BarcodeLookupSource).filter(
            BarcodeLookupSource.code == source_data["code"]
        ).first()

        if not existing:
            source = BarcodeLookupSource(
                name=source_data["name"],
                code=source_data["code"],
                base_url=source_data["base_url"],
                api_path=source_data["api_path"],
                sort_order=source_data["sort_order"],
                description=source_data["description"],
                is_hardcoded=True,
                cancelled=False,
            )
            db.add(source)
            added += 1

    if added:
        db.commit()
        logger.info(f"[BarcodeSource] Seeded {added} hardcoded sources")
    else:
        logger.info("[BarcodeSource] All hardcoded sources already present")


async def lookup_barcode_chain(db: Session, barcode: str) -> dict:
    """
    Search barcode trying all active sources in sort_order.
    Stops at the first result found.
    Returns dict with source_code and source_name indicating which source found it.
    """
    sources = db.query(BarcodeLookupSource).filter(
        BarcodeLookupSource.cancelled == False
    ).order_by(BarcodeLookupSource.sort_order).all()

    for source in sources:
        logger.info(f"[BarcodeChain] Trying {source.name} for barcode {barcode}")
        result = await GenericBarcodeClient.lookup(
            source.base_url, source.api_path, barcode
        )
        if result.get("found"):
            result["source_code"] = source.code
            result["source_name"] = source.name
            logger.info(f"[BarcodeChain] Found on {source.name}")
            return result

    logger.info(f"[BarcodeChain] Barcode {barcode} not found on any source")
    return {"found": False, "barcode": barcode, "source_code": None, "source_name": None}
