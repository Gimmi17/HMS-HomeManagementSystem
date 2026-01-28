"""
OCR Microservice
Extracts text from receipt images using EasyOCR.
"""

import io
import os
import re
import gc
import json
import logging
import traceback
from datetime import datetime
from typing import Optional
from dataclasses import dataclass, asdict

import numpy as np
import easyocr
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log directory for OCR scans
OCR_LOG_DIR = "/app/logs"
OCR_LOG_FILE = os.path.join(OCR_LOG_DIR, "ocr_scans.jsonl")
ERROR_LOG_FILE = os.path.join(OCR_LOG_DIR, "ocr_errors.jsonl")

# Initialize EasyOCR reader (Italian + English)
logger.info("Loading EasyOCR models...")
reader = easyocr.Reader(['it', 'en'], gpu=False)
logger.info("EasyOCR models loaded successfully")


def ensure_log_dir():
    """Ensure log directory exists"""
    os.makedirs(OCR_LOG_DIR, exist_ok=True)


def log_ocr_scan(filename: str, raw_text: str, raw_lines: list, parsed_lines: list,
                 store_name: Optional[str], total_amount: Optional[float],
                 avg_confidence: float, image_size: tuple):
    """Log OCR scan results to JSONL file for future analysis"""
    try:
        ensure_log_dir()
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "filename": filename,
            "image_size": {"width": image_size[0], "height": image_size[1]},
            "raw_text": raw_text,
            "raw_lines_count": len(raw_lines),
            "raw_lines": raw_lines,
            "parsed_lines_count": len(parsed_lines),
            "parsed_lines": parsed_lines,
            "store_detected": store_name,
            "total_detected": total_amount,
            "average_confidence": avg_confidence
        }
        with open(OCR_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        logger.info(f"Logged OCR scan: {filename}")
    except Exception as e:
        logger.warning(f"Failed to log OCR scan: {e}")


def log_ocr_error(filename: str, error: str, error_type: str,
                  image_size: Optional[tuple] = None, stage: str = "unknown"):
    """Log OCR errors for debugging"""
    try:
        ensure_log_dir()
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "filename": filename,
            "error": error,
            "error_type": error_type,
            "stage": stage,
            "image_size": {"width": image_size[0], "height": image_size[1]} if image_size else None,
            "traceback": traceback.format_exc()
        }
        with open(ERROR_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        logger.error(f"OCR Error logged: {error_type} - {error}")
    except Exception as e:
        logger.warning(f"Failed to log OCR error: {e}")


app = FastAPI(
    title="OCR Service",
    description="Receipt OCR processing with EasyOCR",
    version="2.0.0"
)

# Italian receipt patterns - only skip obvious non-product lines
SKIP_PATTERNS = [
    r'^\s*TOTALE\s*€?\s*\d',  # TOTALE with price
    r'^\s*SUBTOTALE\s*€?\s*\d',
    r'^\s*CONTANTE\s*€?\s*\d',
    r'^\s*RESTO\s*€?\s*\d',
    r'^\s*BANCOMAT\s*',
    r'^\s*CARTA\s*(DI\s*)?CREDITO',
    r'^\s*P\.?\s*IVA\s*:?\s*\d',
    r'^\s*C\.?\s*F\.?\s*:?\s*[A-Z0-9]',
    r'^\s*TEL\.?\s*:?\s*\d',
    r'^\s*\d{2}[/.-]\d{2}[/.-]\d{2,4}\s*$',  # Pure dates
    r'^\s*\d{2}:\d{2}(:\d{2})?\s*$',  # Pure times
    r'^\s*[-=_*#]{3,}\s*$',  # Separators
    r'^\s*$',  # Empty lines
]

KNOWN_STORES = [
    'CONAD', 'COOP', 'ESSELUNGA', 'CARREFOUR', 'LIDL', 'EUROSPIN',
    'ALDI', 'PENNY', 'MD', 'FAMILA', 'PAM', 'DESPAR', 'INTERSPAR',
    'IPER', 'BENNET', 'TIGRE', 'SIGMA', 'CRAI', 'TUODI', 'TODIS'
]

ITALIAN_UNITS = {
    'PZ': 'pz', 'KG': 'kg', 'GR': 'g', 'LT': 'l',
    'ML': 'ml', 'CONF': 'conf', 'PKG': 'pkg', 'UN': 'un',
}


@dataclass
class ParsedLine:
    raw_text: str
    parsed_name: Optional[str] = None
    parsed_quantity: Optional[float] = None
    parsed_unit_price: Optional[float] = None
    parsed_total_price: Optional[float] = None
    is_product: bool = True
    confidence: float = 0.0


def preprocess_image(image: Image.Image) -> Image.Image:
    """Preprocess image for better OCR - optimized for memory"""
    # Handle EXIF orientation (common issue with phone photos)
    try:
        from PIL import ExifTags
        for orientation in ExifTags.TAGS.keys():
            if ExifTags.TAGS[orientation] == 'Orientation':
                break
        exif = image._getexif()
        if exif is not None:
            orientation_value = exif.get(orientation)
            if orientation_value == 3:
                image = image.rotate(180, expand=True)
            elif orientation_value == 6:
                image = image.rotate(270, expand=True)
            elif orientation_value == 8:
                image = image.rotate(90, expand=True)
    except (AttributeError, KeyError, IndexError):
        pass

    # Convert to RGB for processing
    if image.mode != 'RGB':
        image = image.convert('RGB')

    # Resize more aggressively to save memory
    # Receipts don't need high resolution for text extraction
    min_dim = 600
    max_dim = 1200  # Reduced from 2000 to save memory
    width, height = image.size

    if min(width, height) < min_dim:
        scale = min_dim / min(width, height)
        new_size = (int(width * scale), int(height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
    elif max(width, height) > max_dim:
        scale = max_dim / max(width, height)
        new_size = (int(width * scale), int(height * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    return image


def should_skip_line(text: str) -> bool:
    """Check if line should be skipped - be conservative, keep more lines"""
    text_stripped = text.strip()

    # Skip very short lines
    if len(text_stripped) < 2:
        return True

    # Skip lines that are only numbers/punctuation (no letters at all)
    if re.match(r'^[\d.,\s€]+$', text_stripped):
        return True

    # Skip lines matching skip patterns
    text_upper = text_stripped.upper()
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, text_upper, re.IGNORECASE):
            return True

    return False


def parse_price(text: str) -> Optional[float]:
    """Parse Italian price format"""
    patterns = [
        r'(\d+)[,.](\d{2})\s*(?:EUR|€)?',
        r'€\s*(\d+)[,.](\d{2})',
        r'EUR\s*(\d+)[,.](\d{2})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return float(f"{match.group(1)}.{match.group(2)}")
            except (ValueError, IndexError):
                continue
    return None


def parse_quantity(text: str) -> tuple[Optional[float], Optional[str]]:
    """Parse quantity from receipt line"""
    text_upper = text.upper()

    # Pattern: "2x" at start
    match = re.match(r'^(\d+)\s*[xX]\s*', text)
    if match:
        return float(match.group(1)), 'pz'

    # Pattern: "KG 0,800"
    match = re.search(r'(KG|GR|LT|ML)\.?\s*(\d+)[,.](\d+)', text_upper)
    if match:
        unit = ITALIAN_UNITS.get(match.group(1), match.group(1).lower())
        quantity = float(f"{match.group(2)}.{match.group(3)}")
        return quantity, unit

    # Pattern: "PZ 3"
    match = re.search(r'(PZ|CONF|UN)\.?\s*(\d+)', text_upper)
    if match:
        unit = ITALIAN_UNITS.get(match.group(1), match.group(1).lower())
        return float(match.group(2)), unit

    return None, None


def parse_line(raw_text: str, confidence: float = 0.8) -> ParsedLine:
    """Parse a single receipt line"""
    result = ParsedLine(
        raw_text=raw_text,
        confidence=confidence,
        is_product=not should_skip_line(raw_text)
    )

    if not result.is_product:
        return result

    # Find prices
    price_pattern = r'(\d+)[,.](\d{2})(?=\s|$|€)'
    prices = re.findall(price_pattern, raw_text)
    prices = [float(f"{p[0]}.{p[1]}") for p in prices]

    if len(prices) >= 2:
        result.parsed_total_price = prices[-1]
        result.parsed_unit_price = prices[-2]
    elif len(prices) == 1:
        result.parsed_total_price = prices[0]

    # Extract quantity
    quantity, unit = parse_quantity(raw_text)
    if quantity:
        result.parsed_quantity = quantity

    # Clean product name - be less aggressive
    name = raw_text
    # Remove prices at end
    name = re.sub(r'\s*\d+[,.]\d{2}\s*€?\s*$', '', name)
    # Remove € prices
    name = re.sub(r'€\s*\d+[,.]\d{2}', '', name)
    # Remove quantity prefix like "2x"
    name = re.sub(r'^\d+\s*[xX]\s*', '', name)
    # Remove weight/unit patterns
    name = re.sub(r'\s*(KG|GR|LT|ML)\s*\d+[,.]?\d*\s*', ' ', name, flags=re.IGNORECASE)
    # Clean up whitespace
    name = ' '.join(name.split()).strip(' -_*')

    # If cleaned name is too short but raw has content, use cleaned raw
    if len(name) < 2 and len(raw_text.strip()) >= 3:
        # Just remove obvious non-text characters
        name = re.sub(r'[€\d,.]+\s*$', '', raw_text).strip()
        name = ' '.join(name.split()).strip(' -_*')

    if name and len(name) >= 2:
        result.parsed_name = name
    else:
        # Last resort - use raw text
        result.parsed_name = raw_text.strip()

    return result


def detect_store(lines: list[str]) -> Optional[str]:
    """Detect store name from first lines"""
    for line in lines[:5]:
        line_upper = line.upper()
        for store in KNOWN_STORES:
            if store in line_upper:
                return store
    return None


def extract_total(lines: list[str]) -> Optional[float]:
    """Extract total amount"""
    for line in reversed(lines):
        if 'TOTALE' in line.upper() or 'TOTAL' in line.upper():
            price = parse_price(line)
            if price:
                return price
    return None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "ocr", "engine": "easyocr"}


@app.post("/process")
async def process_receipt(file: UploadFile = File(...)):
    """
    Process a receipt image and extract text.

    Returns:
        - raw_text: Full extracted text
        - lines: Parsed product lines
        - store_name: Detected store (if any)
        - total_amount: Detected total (if any)
        - average_confidence: OCR confidence score
    """
    filename = file.filename or "unknown"
    original_size = None

    # Validate file type
    if file.content_type not in ['image/jpeg', 'image/png', 'image/webp']:
        log_ocr_error(filename, "Unsupported image format", "validation_error", stage="validation")
        raise HTTPException(400, "Unsupported image format. Use JPG, PNG, or WEBP.")

    try:
        # Read and preprocess image
        logger.info(f"Reading image: {filename}")
        contents = await file.read()
        logger.info(f"Image size: {len(contents)} bytes")

        image = Image.open(io.BytesIO(contents))
        original_size = image.size
        logger.info(f"Image dimensions: {original_size}")

        processed = preprocess_image(image)
        logger.info(f"Processing image: {original_size} -> {processed.size}")

        # Save preprocessed image to bytes for EasyOCR
        img_buffer = io.BytesIO()
        processed.save(img_buffer, format='JPEG', quality=95)
        img_bytes = img_buffer.getvalue()

        logger.info(f"Running EasyOCR on {len(img_bytes)} bytes...")

        # Force garbage collection before OCR to free memory
        gc.collect()

        # Run EasyOCR with raw bytes
        # Returns list of (bbox, text, confidence)
        try:
            results = reader.readtext(
                img_bytes,
                detail=1,
                paragraph=False,
                min_size=10,
                text_threshold=0.7,
                low_text=0.4,
                batch_size=1,  # Lower batch size to reduce memory
            )
            logger.info(f"EasyOCR found {len(results)} text regions")
        except Exception as ocr_error:
            logger.error(f"EasyOCR failed: {ocr_error}")
            log_ocr_error(filename, str(ocr_error), type(ocr_error).__name__, original_size, stage="easyocr")
            gc.collect()
            raise

        if not results:
            logger.warning("No text detected in image")
            return JSONResponse({
                "raw_text": "",
                "lines": [],
                "store_name": None,
                "total_amount": None,
                "average_confidence": 0.0
            })

        # Sort results by vertical position (top to bottom)
        results_sorted = sorted(results, key=lambda x: x[0][0][1])

        # Group into lines based on vertical position
        raw_lines = []
        confidences = []
        current_line = []
        current_y = None
        line_threshold = 20  # pixels

        for bbox, text, conf in results_sorted:
            y = bbox[0][1]  # top-left y coordinate
            confidences.append(conf)

            if current_y is None or abs(y - current_y) < line_threshold:
                current_line.append((bbox[0][0], text))  # (x, text)
                current_y = y if current_y is None else (current_y + y) / 2
            else:
                # Sort by x position and join
                current_line.sort(key=lambda x: x[0])
                line_text = ' '.join([t for _, t in current_line])
                if line_text.strip():
                    raw_lines.append(line_text)
                current_line = [(bbox[0][0], text)]
                current_y = y

        # Don't forget the last line
        if current_line:
            current_line.sort(key=lambda x: x[0])
            line_text = ' '.join([t for _, t in current_line])
            if line_text.strip():
                raw_lines.append(line_text)

        # Build response
        raw_text = '\n'.join(raw_lines)
        store_name = detect_store(raw_lines)
        total_amount = extract_total(raw_lines)

        # Parse lines
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.8
        parsed_lines = []
        for text in raw_lines:
            parsed = parse_line(text, avg_conf)
            if parsed.is_product and parsed.parsed_name:
                parsed_lines.append(asdict(parsed))

        logger.info(f"Processed receipt: {len(parsed_lines)} products, store={store_name}, confidence={avg_conf:.2f}")

        # Log scan for future analysis
        log_ocr_scan(
            filename=file.filename or "unknown",
            raw_text=raw_text,
            raw_lines=raw_lines,
            parsed_lines=parsed_lines,
            store_name=store_name,
            total_amount=total_amount,
            avg_confidence=avg_conf,
            image_size=original_size
        )

        # Free memory after processing
        del image, processed, img_bytes, results
        gc.collect()

        return JSONResponse({
            "raw_text": raw_text,
            "lines": parsed_lines,
            "store_name": store_name,
            "total_amount": total_amount,
            "average_confidence": avg_conf
        })

    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        log_ocr_error(filename, str(e), type(e).__name__, original_size, stage="processing")
        # Force garbage collection on error
        gc.collect()
        raise HTTPException(500, f"OCR processing failed: {str(e)}")


@app.get("/logs")
async def get_logs(limit: int = 50):
    """
    Get recent OCR scan logs for analysis.

    Returns the last N scans with all their data.
    """
    try:
        if not os.path.exists(OCR_LOG_FILE):
            return {"scans": [], "total": 0}

        scans = []
        with open(OCR_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        scans.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        # Return last N scans
        recent_scans = scans[-limit:] if limit > 0 else scans

        # Calculate stats
        total_scans = len(scans)
        avg_lines = sum(s.get("parsed_lines_count", 0) for s in scans) / total_scans if total_scans > 0 else 0
        avg_confidence = sum(s.get("average_confidence", 0) for s in scans) / total_scans if total_scans > 0 else 0

        return {
            "scans": recent_scans,
            "total": total_scans,
            "stats": {
                "average_parsed_lines": round(avg_lines, 1),
                "average_confidence": round(avg_confidence, 3)
            }
        }
    except Exception as e:
        logger.error(f"Failed to read logs: {e}")
        return {"scans": [], "total": 0, "error": str(e)}


@app.get("/errors")
async def get_errors(limit: int = 50):
    """
    Get recent OCR error logs for debugging.

    Returns the last N errors with full details.
    """
    try:
        if not os.path.exists(ERROR_LOG_FILE):
            return {"errors": [], "total": 0}

        errors = []
        with open(ERROR_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        errors.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

        # Return last N errors
        recent_errors = errors[-limit:] if limit > 0 else errors

        return {
            "errors": recent_errors,
            "total": len(errors)
        }
    except Exception as e:
        logger.error(f"Failed to read error logs: {e}")
        return {"errors": [], "total": 0, "error": str(e)}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "OCR Service",
        "version": "2.0.0",
        "engine": "EasyOCR",
        "endpoints": {
            "/health": "Health check",
            "/process": "POST - Process receipt image",
            "/logs": "GET - View OCR scan logs"
        }
    }
