"""
Receipt OCR Service
Extract and parse text from receipt images using PaddleOCR.

Features:
- Image preprocessing (grayscale, contrast, resize)
- Text extraction with PaddleOCR
- Italian receipt parsing (prices, quantities, abbreviations)
- Filter non-product lines (TOTALE, IVA, RESTO, etc.)
"""

import os
import re
import logging
from typing import Optional
from dataclasses import dataclass
from pathlib import Path

# Try to import PIL - required for image processing
try:
    from PIL import Image, ImageEnhance, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Lazy import PaddleOCR to avoid loading at module import time
_ocr_instance = None
PADDLEOCR_AVAILABLE = None  # Will be set on first use

logger = logging.getLogger(__name__)


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


# Italian receipt abbreviations and their meanings
ITALIAN_UNITS = {
    'PZ': 'pz',      # Pezzi
    'KG': 'kg',      # Kilogrammi
    'GR': 'g',       # Grammi
    'LT': 'l',       # Litri
    'ML': 'ml',      # Millilitri
    'CONF': 'conf',  # Confezione
    'PKG': 'pkg',    # Package
    'UN': 'un',      # Unita
}

# Lines to skip (non-product lines)
SKIP_PATTERNS = [
    r'^\s*TOTALE\s*',
    r'^\s*SUBTOTALE\s*',
    r'^\s*IVA\s*',
    r'^\s*CONTANTE\s*',
    r'^\s*RESTO\s*',
    r'^\s*BANCOMAT\s*',
    r'^\s*CARTA\s*',
    r'^\s*SCONTRINO\s*',
    r'^\s*FISCALE\s*',
    r'^\s*CASSA\s*',
    r'^\s*DATA\s*',
    r'^\s*ORA\s*',
    r'^\s*P\.?\s*IVA\s*',
    r'^\s*C\.?\s*F\.?\s*',
    r'^\s*TEL\.?\s*',
    r'^\s*FAX\.?\s*',
    r'^\s*GRAZIE\s*',
    r'^\s*ARRIVEDERCI\s*',
    r'^\s*\d{2}[/.-]\d{2}[/.-]\d{2,4}\s*',  # Date patterns
    r'^\s*\d{2}:\d{2}\s*',  # Time patterns
    r'^\s*[-=_*]+\s*$',  # Separator lines
    r'^\s*$',  # Empty lines
]

# Common Italian supermarket chains (for store detection)
KNOWN_STORES = [
    'CONAD', 'COOP', 'ESSELUNGA', 'CARREFOUR', 'LIDL', 'EUROSPIN',
    'ALDI', 'PENNY', 'MD', 'FAMILA', 'PAM', 'DESPAR', 'INTERSPAR',
    'IPER', 'BENNET', 'TIGRE', 'SIGMA', 'CRAI', 'TUODI', 'TODIS'
]


def is_ocr_available() -> bool:
    """Check if PaddleOCR is available"""
    global PADDLEOCR_AVAILABLE
    if PADDLEOCR_AVAILABLE is None:
        try:
            from paddleocr import PaddleOCR
            PADDLEOCR_AVAILABLE = True
        except ImportError:
            PADDLEOCR_AVAILABLE = False
            logger.warning("PaddleOCR not installed. OCR features disabled. Install with: pip install paddleocr paddlepaddle")
    return PADDLEOCR_AVAILABLE


def get_ocr_instance():
    """Get or create the PaddleOCR instance (lazy loading)"""
    global _ocr_instance
    if _ocr_instance is None:
        if not is_ocr_available():
            raise ImportError(
                "PaddleOCR non installato. Per abilitare l'OCR, installa: pip install paddleocr paddlepaddle"
            )
        from paddleocr import PaddleOCR
        # Use Italian language, GPU disabled for compatibility
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='it',
            use_gpu=False,
            show_log=False
        )
        logger.info("PaddleOCR initialized successfully")
    return _ocr_instance


def preprocess_image(image_path: str):
    """
    Preprocess image for better OCR results.

    - Convert to grayscale
    - Enhance contrast
    - Sharpen
    - Resize if too small
    """
    if not PIL_AVAILABLE:
        raise ImportError("Pillow non installato. Installa con: pip install Pillow")

    img = Image.open(image_path)

    # Convert to grayscale
    if img.mode != 'L':
        img = img.convert('L')

    # Resize if too small (OCR works better with larger images)
    min_dimension = 1000
    if min(img.size) < min_dimension:
        scale = min_dimension / min(img.size)
        new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    # Enhance contrast
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.5)

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)

    return img


def parse_price(text: str) -> Optional[float]:
    """
    Parse Italian price format (e.g., "1,99" or "12.50" or "1,99 EUR")
    Returns price as float or None if not found
    """
    # Match common Italian price patterns
    patterns = [
        r'(\d+)[,.](\d{2})\s*(?:EUR|€)?',  # 1,99 or 1.99
        r'€\s*(\d+)[,.](\d{2})',  # € 1,99
        r'EUR\s*(\d+)[,.](\d{2})',  # EUR 1,99
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
    """
    Parse quantity from receipt line.

    Examples:
    - "2x" or "2 x" -> (2.0, 'pz')
    - "KG 0,800" -> (0.8, 'kg')
    - "PZ 3" -> (3.0, 'pz')

    Returns (quantity, unit) tuple
    """
    text_upper = text.upper()

    # Pattern: "2x" or "2 x" at start
    match = re.match(r'^(\d+)\s*[xX]\s*', text)
    if match:
        return float(match.group(1)), 'pz'

    # Pattern: "KG 0,800" or "KG. 0.800"
    match = re.search(r'(KG|GR|LT|ML)\.?\s*(\d+)[,.](\d+)', text_upper)
    if match:
        unit = ITALIAN_UNITS.get(match.group(1), match.group(1).lower())
        quantity = float(f"{match.group(2)}.{match.group(3)}")
        return quantity, unit

    # Pattern: "PZ 3" or "CONF 2"
    match = re.search(r'(PZ|CONF|UN)\.?\s*(\d+)', text_upper)
    if match:
        unit = ITALIAN_UNITS.get(match.group(1), match.group(1).lower())
        return float(match.group(2)), unit

    # Pattern: quantity at end "x3" or "x 3"
    match = re.search(r'[xX]\s*(\d+)\s*$', text)
    if match:
        return float(match.group(1)), 'pz'

    return None, None


def should_skip_line(text: str) -> bool:
    """Check if line should be skipped (non-product line)"""
    text_upper = text.upper().strip()

    for pattern in SKIP_PATTERNS:
        if re.match(pattern, text_upper, re.IGNORECASE):
            return True

    # Skip very short lines
    if len(text.strip()) < 3:
        return True

    # Skip lines that are just numbers (likely totals or codes)
    if re.match(r'^\s*[\d.,\s]+\s*$', text):
        return True

    return False


def detect_store_name(lines: list[str]) -> Optional[str]:
    """
    Try to detect store name from first few lines of receipt.
    Looks for known store chains.
    """
    # Check first 5 lines for store name
    for line in lines[:5]:
        line_upper = line.upper()
        for store in KNOWN_STORES:
            if store in line_upper:
                return store
    return None


def extract_total(lines: list[str]) -> Optional[float]:
    """
    Extract total amount from receipt.
    Looks for TOTALE followed by price.
    """
    for line in reversed(lines):  # Start from bottom
        if 'TOTALE' in line.upper() or 'TOTAL' in line.upper():
            price = parse_price(line)
            if price:
                return price
    return None


def parse_receipt_line(raw_text: str, confidence: float) -> ParsedReceiptLine:
    """
    Parse a single receipt line into structured data.

    Extracts:
    - Product name
    - Quantity
    - Unit price
    - Total price
    """
    result = ParsedReceiptLine(
        raw_text=raw_text,
        confidence=confidence,
        is_product=not should_skip_line(raw_text)
    )

    if not result.is_product:
        return result

    # Extract prices (usually at the end of line)
    # Look for patterns like "PRODOTTO   1,99" or "PRODOTTO 2x1,99   3,98"

    # Find all prices in the line
    price_pattern = r'(\d+)[,.](\d{2})(?=\s|$|€)'
    prices = re.findall(price_pattern, raw_text)
    prices = [float(f"{p[0]}.{p[1]}") for p in prices]

    if len(prices) >= 2:
        # Multiple prices: last is total, second-to-last might be unit price
        result.parsed_total_price = prices[-1]
        result.parsed_unit_price = prices[-2]
    elif len(prices) == 1:
        result.parsed_total_price = prices[0]

    # Extract quantity
    quantity, unit = parse_quantity(raw_text)
    if quantity:
        result.parsed_quantity = quantity

    # Clean up product name (remove prices, quantities, units)
    name = raw_text

    # Remove price patterns
    name = re.sub(r'\d+[,.]\d{2}\s*(?:EUR|€)?\s*', '', name)
    name = re.sub(r'€\s*\d+[,.]\d{2}', '', name)

    # Remove quantity patterns
    name = re.sub(r'^\d+\s*[xX]\s*', '', name)
    name = re.sub(r'[xX]\s*\d+\s*$', '', name)
    name = re.sub(r'(KG|GR|LT|ML|PZ|CONF|UN)\.?\s*\d+[,.]?\d*', '', name, flags=re.IGNORECASE)

    # Clean up whitespace
    name = ' '.join(name.split())
    name = name.strip(' -_*')

    if name:
        result.parsed_name = name

    return result


def process_receipt(image_path: str) -> ReceiptOCRResult:
    """
    Process a receipt image and extract structured data.

    Args:
        image_path: Path to the receipt image

    Returns:
        ReceiptOCRResult with extracted data
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Receipt image not found: {image_path}")

    # Preprocess image
    preprocessed = preprocess_image(image_path)

    # Save preprocessed image temporarily for OCR
    temp_path = Path(image_path).parent / f"temp_{Path(image_path).name}"
    preprocessed.save(str(temp_path))

    try:
        # Run OCR
        ocr = get_ocr_instance()
        result = ocr.ocr(str(temp_path), cls=True)

        if not result or not result[0]:
            return ReceiptOCRResult(
                raw_text="",
                lines=[],
                average_confidence=0.0
            )

        # Extract text and confidence from OCR result
        raw_lines = []
        confidences = []

        for line in result[0]:
            text = line[1][0]
            confidence = line[1][1]
            raw_lines.append((text, confidence))
            confidences.append(confidence)

        # Build raw text
        raw_text = '\n'.join([line[0] for line in raw_lines])

        # Detect store name
        store_name = detect_store_name([line[0] for line in raw_lines])

        # Extract total
        total_amount = extract_total([line[0] for line in raw_lines])

        # Parse each line
        parsed_lines = []
        for text, confidence in raw_lines:
            parsed = parse_receipt_line(text, confidence)
            parsed_lines.append(parsed)

        # Calculate average confidence
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        return ReceiptOCRResult(
            raw_text=raw_text,
            lines=parsed_lines,
            store_name=store_name,
            total_amount=total_amount,
            average_confidence=avg_confidence
        )

    finally:
        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()


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
