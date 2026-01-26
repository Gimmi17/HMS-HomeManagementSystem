"""
Receipt OCR Service
Calls external OCR microservice to extract text from receipt images.

The actual OCR processing is done by a separate container (ocr-service)
to keep the main backend lightweight.
"""

import os
import logging
from typing import Optional
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

# OCR Service URL (from environment or default)
OCR_SERVICE_URL = os.environ.get("OCR_SERVICE_URL", "http://ocr:8001")


@dataclass
class ParsedReceiptLine:
    """Represents a parsed line from a receipt"""
    raw_text: str
    parsed_name: Optional[str] = None
    parsed_quantity: Optional[float] = None
    parsed_unit_price: Optional[float] = None
    parsed_total_price: Optional[float] = None
    is_product: bool = True
    confidence: float = 0.0


@dataclass
class ReceiptOCRResult:
    """Result of OCR processing on a receipt"""
    raw_text: str
    lines: list[ParsedReceiptLine]
    store_name: Optional[str] = None
    total_amount: Optional[float] = None
    average_confidence: float = 0.0


async def check_ocr_service_health() -> bool:
    """Check if OCR service is available"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OCR_SERVICE_URL}/health", timeout=5.0)
            return response.status_code == 200
    except Exception as e:
        logger.warning(f"OCR service health check failed: {e}")
        return False


def check_ocr_service_health_sync() -> bool:
    """Check if OCR service is available (sync version)"""
    try:
        with httpx.Client() as client:
            response = client.get(f"{OCR_SERVICE_URL}/health", timeout=5.0)
            return response.status_code == 200
    except Exception as e:
        logger.warning(f"OCR service health check failed: {e}")
        return False


async def process_receipt_async(image_path: str) -> ReceiptOCRResult:
    """
    Process a receipt image by calling the OCR microservice.

    Args:
        image_path: Path to the receipt image

    Returns:
        ReceiptOCRResult with extracted data
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Receipt image not found: {image_path}")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Send image to OCR service
            with open(image_path, "rb") as f:
                files = {"file": (os.path.basename(image_path), f, "image/jpeg")}
                response = await client.post(f"{OCR_SERVICE_URL}/process", files=files)

            if response.status_code != 200:
                error_detail = response.json().get("detail", "Unknown error")
                raise Exception(f"OCR service error: {error_detail}")

            data = response.json()

            # Convert response to ReceiptOCRResult
            lines = [
                ParsedReceiptLine(
                    raw_text=line.get("raw_text", ""),
                    parsed_name=line.get("parsed_name"),
                    parsed_quantity=line.get("parsed_quantity"),
                    parsed_unit_price=line.get("parsed_unit_price"),
                    parsed_total_price=line.get("parsed_total_price"),
                    is_product=line.get("is_product", True),
                    confidence=line.get("confidence", 0.0)
                )
                for line in data.get("lines", [])
            ]

            return ReceiptOCRResult(
                raw_text=data.get("raw_text", ""),
                lines=lines,
                store_name=data.get("store_name"),
                total_amount=data.get("total_amount"),
                average_confidence=data.get("average_confidence", 0.0)
            )

    except httpx.ConnectError:
        logger.error("Cannot connect to OCR service. Is it running?")
        raise Exception("Servizio OCR non disponibile. Riprova più tardi.")
    except httpx.TimeoutException:
        logger.error("OCR service timeout")
        raise Exception("Timeout durante l'elaborazione OCR. Riprova.")
    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        raise


def process_receipt(image_path: str) -> ReceiptOCRResult:
    """
    Process a receipt image (sync version).

    Args:
        image_path: Path to the receipt image

    Returns:
        ReceiptOCRResult with extracted data
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Receipt image not found: {image_path}")

    try:
        with httpx.Client(timeout=60.0) as client:
            # Send image to OCR service
            with open(image_path, "rb") as f:
                files = {"file": (os.path.basename(image_path), f, "image/jpeg")}
                response = client.post(f"{OCR_SERVICE_URL}/process", files=files)

            if response.status_code != 200:
                error_detail = response.json().get("detail", "Unknown error")
                raise Exception(f"OCR service error: {error_detail}")

            data = response.json()

            # Convert response to ReceiptOCRResult
            lines = [
                ParsedReceiptLine(
                    raw_text=line.get("raw_text", ""),
                    parsed_name=line.get("parsed_name"),
                    parsed_quantity=line.get("parsed_quantity"),
                    parsed_unit_price=line.get("parsed_unit_price"),
                    parsed_total_price=line.get("parsed_total_price"),
                    is_product=line.get("is_product", True),
                    confidence=line.get("confidence", 0.0)
                )
                for line in data.get("lines", [])
            ]

            return ReceiptOCRResult(
                raw_text=data.get("raw_text", ""),
                lines=lines,
                store_name=data.get("store_name"),
                total_amount=data.get("total_amount"),
                average_confidence=data.get("average_confidence", 0.0)
            )

    except httpx.ConnectError:
        logger.error("Cannot connect to OCR service. Is it running?")
        raise Exception("Servizio OCR non disponibile. Riprova più tardi.")
    except httpx.TimeoutException:
        logger.error("OCR service timeout")
        raise Exception("Timeout durante l'elaborazione OCR. Riprova.")
    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        raise


def get_product_lines(ocr_result: ReceiptOCRResult) -> list[ParsedReceiptLine]:
    """
    Filter OCR result to only include product lines.

    Returns list of ParsedReceiptLine where is_product=True and
    parsed_name is not empty.
    """
    return [
        line for line in ocr_result.lines
        if line.is_product and line.parsed_name
    ]
