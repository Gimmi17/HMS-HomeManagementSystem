"""
OCR Microservice
Extracts text from receipt images using PaddleOCR.
"""

import io
import re
import logging
from typing import Optional
from dataclasses import dataclass, asdict

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image, ImageEnhance, ImageFilter
from paddleocr import PaddleOCR

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OCR Service",
    description="Receipt OCR processing with PaddleOCR",
    version="1.0.0"
)

# Initialize PaddleOCR (lazy loading)
_ocr_instance = None


def get_ocr():
    """Get or create OCR instance"""
    global _ocr_instance
    if _ocr_instance is None:
        logger.info("Initializing PaddleOCR...")
        _ocr_instance = PaddleOCR(
            use_angle_cls=True,
            lang='it'
        )
        logger.info("PaddleOCR initialized")
    return _ocr_instance


# Italian receipt patterns
SKIP_PATTERNS = [
    r'^\s*TOTALE\s*', r'^\s*SUBTOTALE\s*', r'^\s*IVA\s*',
    r'^\s*CONTANTE\s*', r'^\s*RESTO\s*', r'^\s*BANCOMAT\s*',
    r'^\s*CARTA\s*', r'^\s*SCONTRINO\s*', r'^\s*FISCALE\s*',
    r'^\s*CASSA\s*', r'^\s*DATA\s*', r'^\s*ORA\s*',
    r'^\s*P\.?\s*IVA\s*', r'^\s*C\.?\s*F\.?\s*',
    r'^\s*TEL\.?\s*', r'^\s*GRAZIE\s*', r'^\s*ARRIVEDERCI\s*',
    r'^\s*\d{2}[/.-]\d{2}[/.-]\d{2,4}\s*',
    r'^\s*\d{2}:\d{2}\s*',
    r'^\s*[-=_*]+\s*$', r'^\s*$',
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
    """Preprocess image for better OCR"""
    # Convert to grayscale
    if image.mode != 'L':
        image = image.convert('L')

    # Resize if too small
    min_dim = 1000
    if min(image.size) < min_dim:
        scale = min_dim / min(image.size)
        new_size = (int(image.size[0] * scale), int(image.size[1] * scale))
        image = image.resize(new_size, Image.Resampling.LANCZOS)

    # Enhance contrast
    image = ImageEnhance.Contrast(image).enhance(1.5)

    # Sharpen
    image = image.filter(ImageFilter.SHARPEN)

    return image


def should_skip_line(text: str) -> bool:
    """Check if line should be skipped"""
    text_upper = text.upper().strip()
    for pattern in SKIP_PATTERNS:
        if re.match(pattern, text_upper, re.IGNORECASE):
            return True
    if len(text.strip()) < 3:
        return True
    if re.match(r'^\s*[\d.,\s]+\s*$', text):
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


def parse_line(raw_text: str, confidence: float) -> ParsedLine:
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

    # Clean product name
    name = raw_text
    name = re.sub(r'\d+[,.]\d{2}\s*(?:EUR|€)?\s*', '', name)
    name = re.sub(r'€\s*\d+[,.]\d{2}', '', name)
    name = re.sub(r'^\d+\s*[xX]\s*', '', name)
    name = re.sub(r'[xX]\s*\d+\s*$', '', name)
    name = re.sub(r'(KG|GR|LT|ML|PZ|CONF|UN)\.?\s*\d+[,.]?\d*', '', name, flags=re.IGNORECASE)
    name = ' '.join(name.split()).strip(' -_*')

    if name:
        result.parsed_name = name

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
    return {"status": "ok", "service": "ocr"}


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
    # Validate file type
    if file.content_type not in ['image/jpeg', 'image/png', 'image/webp']:
        raise HTTPException(400, "Unsupported image format. Use JPG, PNG, or WEBP.")

    try:
        # Read and preprocess image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        processed = preprocess_image(image)

        # Convert to bytes for OCR
        img_byte_arr = io.BytesIO()
        processed.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)

        # Run OCR
        ocr = get_ocr()
        result = ocr.ocr(img_byte_arr, cls=True)

        if not result or not result[0]:
            return JSONResponse({
                "raw_text": "",
                "lines": [],
                "store_name": None,
                "total_amount": None,
                "average_confidence": 0.0
            })

        # Extract text and confidence
        raw_lines = []
        confidences = []

        for line in result[0]:
            text = line[1][0]
            confidence = line[1][1]
            raw_lines.append((text, confidence))
            confidences.append(confidence)

        # Build response
        raw_text = '\n'.join([l[0] for l in raw_lines])
        store_name = detect_store([l[0] for l in raw_lines])
        total_amount = extract_total([l[0] for l in raw_lines])

        # Parse lines
        parsed_lines = []
        for text, conf in raw_lines:
            parsed = parse_line(text, conf)
            if parsed.is_product and parsed.parsed_name:
                parsed_lines.append(asdict(parsed))

        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        logger.info(f"Processed receipt: {len(parsed_lines)} products, store={store_name}")

        return JSONResponse({
            "raw_text": raw_text,
            "lines": parsed_lines,
            "store_name": store_name,
            "total_amount": total_amount,
            "average_confidence": avg_confidence
        })

    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        raise HTTPException(500, f"OCR processing failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "OCR Service",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Health check",
            "/process": "POST - Process receipt image"
        }
    }
