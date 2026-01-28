"""
LLM-powered OCR Service

Uses configured LLM for receipt processing:
- Direct OCR using vision models (OlmOCR, LLaVA, etc.)
- Interpret abbreviated product names
- Smart matching between receipt items and shopping list
"""

import base64
import json
import logging
import re
from typing import Optional
from dataclasses import dataclass

import httpx

from app.integrations.llm import get_ocr_client, LLMClient, LLMConnection

logger = logging.getLogger(__name__)


@dataclass
class LLMMatchResult:
    """Result of LLM-powered matching"""
    receipt_item: str
    suggested_match: Optional[str]
    confidence: float
    interpreted_name: Optional[str] = None  # Full interpretation of abbreviation


@dataclass
class VisionOCRResult:
    """Result of vision-based OCR"""
    raw_text: str
    lines: list[dict]
    store_name: Optional[str] = None
    total_amount: Optional[float] = None
    confidence: float = 0.9  # Vision models are generally confident


async def ocr_with_vision_llm(
    image_path: str,
    client: LLMClient
) -> VisionOCRResult:
    """
    Perform OCR using a vision-capable LLM (OlmOCR, LLaVA, etc.)

    Args:
        image_path: Path to the receipt image
        client: LLM client configured for OCR

    Returns:
        VisionOCRResult with extracted text and parsed lines
    """
    import os
    from PIL import Image
    import io

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Read and encode image
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Resize if needed (OlmOCR recommends max 1288px on longest side)
    try:
        img = Image.open(io.BytesIO(image_bytes))
        max_dim = 1288
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            # Re-encode
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=90)
            image_bytes = buffer.getvalue()
            logger.info(f"Resized image to {new_size}")
    except Exception as e:
        logger.warning(f"Could not resize image: {e}")

    # Encode to base64
    image_b64 = base64.b64encode(image_bytes).decode('utf-8')

    # Determine mime type
    if image_path.lower().endswith('.png'):
        mime_type = 'image/png'
    elif image_path.lower().endswith('.webp'):
        mime_type = 'image/webp'
    else:
        mime_type = 'image/jpeg'

    # Build vision request
    prompt = """Estrai tutto il testo da questo scontrino italiano.
Rispondi con il testo esatto che vedi, riga per riga.
Mantieni le abbreviazioni come sono (es. "LAT PS", "MOZZ BUF").
Non aggiungere interpretazioni, solo il testo grezzo."""

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{image_b64}"
                    }
                }
            ]
        }
    ]

    # Make request directly with httpx (vision format)
    try:
        http_client = await client._get_client()
        payload = {
            "model": client.connection.model,
            "messages": messages,
            "temperature": 0.1,
            "max_tokens": 2000,
        }

        logger.info(f"Sending image to vision LLM: {client.connection.url}")
        response = await http_client.post(
            f"{client.base_url}/v1/chat/completions",
            json=payload,
            timeout=300.0  # Vision requests can be very slow on local models
        )

        if response.status_code != 200:
            logger.error(f"Vision OCR failed: HTTP {response.status_code} - {response.text}")
            raise Exception(f"Vision OCR failed: {response.status_code}")

        data = response.json()
        raw_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not raw_text:
            logger.warning("Vision LLM returned empty text")
            return VisionOCRResult(raw_text="", lines=[])

        logger.info(f"Vision OCR extracted {len(raw_text)} characters")

        # Parse the raw text into lines and product structures
        lines = parse_receipt_text(raw_text)

        # Detect store and total
        store_name = detect_store_from_text(raw_text)
        total_amount = extract_total_from_text(raw_text)

        return VisionOCRResult(
            raw_text=raw_text,
            lines=lines,
            store_name=store_name,
            total_amount=total_amount,
            confidence=0.9
        )

    except httpx.TimeoutException:
        logger.error("Vision OCR timeout")
        raise Exception("Timeout durante OCR")
    except Exception as e:
        logger.error(f"Vision OCR failed: {e}")
        raise


def parse_receipt_text(raw_text: str) -> list[dict]:
    """Parse raw OCR text into product lines"""
    lines = []

    # Skip patterns (non-product lines)
    skip_patterns = [
        r'^\s*TOTALE\s*€?\s*\d',
        r'^\s*SUBTOTALE',
        r'^\s*CONTANTE',
        r'^\s*RESTO',
        r'^\s*BANCOMAT',
        r'^\s*CARTA',
        r'^\s*P\.?\s*IVA',
        r'^\s*C\.?\s*F\.',
        r'^\s*TEL',
        r'^\s*\d{2}[/.-]\d{2}[/.-]\d{2,4}\s*$',
        r'^\s*\d{2}:\d{2}',
        r'^\s*[-=_*#]{3,}',
        r'^\s*$',
    ]

    for line in raw_text.split('\n'):
        line = line.strip()
        if not line or len(line) < 2:
            continue

        # Check skip patterns
        skip = False
        for pattern in skip_patterns:
            if re.match(pattern, line, re.IGNORECASE):
                skip = True
                break

        if skip:
            continue

        # Parse price
        price_match = re.search(r'(\d+)[,.](\d{2})(?:\s*€)?(?:\s*$|\s+)', line)
        total_price = None
        if price_match:
            total_price = float(f"{price_match.group(1)}.{price_match.group(2)}")

        # Clean product name (remove prices)
        name = re.sub(r'\s*\d+[,.]\d{2}\s*€?\s*$', '', line).strip()
        name = re.sub(r'€\s*\d+[,.]\d{2}', '', name).strip()

        if name and len(name) >= 2:
            lines.append({
                "raw_text": line,
                "parsed_name": name,
                "parsed_quantity": 1.0,
                "parsed_unit_price": None,
                "parsed_total_price": total_price,
                "is_product": True,
                "confidence": 0.9
            })

    return lines


def detect_store_from_text(text: str) -> Optional[str]:
    """Detect store name from OCR text"""
    known_stores = [
        'CONAD', 'COOP', 'ESSELUNGA', 'CARREFOUR', 'LIDL', 'EUROSPIN',
        'ALDI', 'PENNY', 'MD', 'FAMILA', 'PAM', 'DESPAR', 'INTERSPAR',
        'IPER', 'BENNET', 'TIGRE', 'SIGMA', 'CRAI', 'TUODI', 'TODIS'
    ]
    text_upper = text.upper()
    for store in known_stores:
        if store in text_upper:
            return store
    return None


def extract_total_from_text(text: str) -> Optional[float]:
    """Extract total amount from OCR text"""
    for line in reversed(text.split('\n')):
        if 'TOTALE' in line.upper() or 'TOTAL' in line.upper():
            match = re.search(r'(\d+)[,.](\d{2})', line)
            if match:
                return float(f"{match.group(1)}.{match.group(2)}")
    return None


async def interpret_receipt_items(
    receipt_items: list[str],
    client: Optional[LLMClient] = None
) -> dict[str, str]:
    """
    Use LLM to interpret abbreviated receipt item names.

    Args:
        receipt_items: List of abbreviated names from OCR
        client: Optional LLM client (uses default OCR client if not provided)

    Returns:
        Dict mapping original name -> interpreted full name
    """
    if not receipt_items:
        return {}

    if client is None:
        client = await get_ocr_client()

    if client is None:
        logger.warning("No LLM client available for OCR")
        return {}

    system_prompt = """Sei un esperto di scontrini italiani dei supermercati.
Interpreta le abbreviazioni dei prodotti alimentari.

Esempi comuni:
- "LAT PS" → "Latte Parzialmente Scremato"
- "MOZZ BUF" → "Mozzarella di Bufala"
- "POM PACH" → "Pomodori Pachino"
- "PAST SFOG" → "Pasta Sfoglia"
- "PROSC COT" → "Prosciutto Cotto"
- "FORM GR" → "Formaggio Grattugiato"

Rispondi SOLO in JSON valido, un oggetto con chiave=abbreviazione, valore=nome completo.
Se non riesci a interpretare, usa il testo originale come valore."""

    user_prompt = f"""Interpreta queste abbreviazioni da uno scontrino italiano:

{json.dumps(receipt_items, ensure_ascii=False, indent=2)}

Rispondi SOLO con un oggetto JSON valido."""

    response = await client.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,
        max_tokens=1000
    )

    if not response:
        return {}

    # Parse JSON response
    try:
        # Clean response (remove markdown code blocks if present)
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse LLM interpretation response: {e}")

    return {}


async def smart_match_items(
    receipt_items: list[str],
    shopping_list_items: list[str],
    client: Optional[LLMClient] = None
) -> list[LLMMatchResult]:
    """
    Use LLM to intelligently match receipt items to shopping list.

    This is the main function for improving fuzzy matching with AI.

    Args:
        receipt_items: List of item names from OCR (possibly abbreviated)
        shopping_list_items: List of item names from shopping list

    Returns:
        List of LLMMatchResult with suggested matches
    """
    if not receipt_items or not shopping_list_items:
        return []

    if client is None:
        client = await get_ocr_client()

    if client is None:
        logger.warning("No LLM client available for OCR matching")
        return []

    system_prompt = """Sei un assistente che aiuta a fare il match tra articoli di uno scontrino italiano e una lista della spesa.

Gli scontrini italiani hanno nomi abbreviati e troncati, ad esempio:
- "LAT PS INT" = Latte Parzialmente Scremato Intero
- "MOZZ BUF" = Mozzarella di Bufala
- "POM PACH" = Pomodori Pachino
- "YOGURT GR BIO" = Yogurt Greco Biologico

Il tuo compito:
1. Interpreta l'abbreviazione dello scontrino
2. Trova la corrispondenza più probabile nella lista della spesa
3. Assegna un punteggio di confidenza

Rispondi SOLO in formato JSON array, con oggetti nel formato:
{
  "item": "testo originale scontrino",
  "interpreted": "interpretazione completa",
  "match": "articolo dalla lista (null se nessun match)",
  "confidence": 0.0-1.0
}"""

    user_prompt = f"""ARTICOLI SCONTRINO:
{json.dumps(receipt_items, ensure_ascii=False, indent=2)}

LISTA DELLA SPESA:
{json.dumps(shopping_list_items, ensure_ascii=False, indent=2)}

Trova i match più probabili. Rispondi SOLO con un JSON array."""

    response = await client.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.2,
        max_tokens=2000
    )

    if not response:
        return []

    # Parse the response
    results = []
    try:
        # Clean response
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)
        if isinstance(data, list):
            for item in data:
                results.append(LLMMatchResult(
                    receipt_item=item.get("item", ""),
                    suggested_match=item.get("match"),
                    confidence=float(item.get("confidence", 0.5)),
                    interpreted_name=item.get("interpreted")
                ))
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Failed to parse LLM match response: {e}")
        # Try line-by-line parsing as fallback
        for line in response.strip().split('\n'):
            line = line.strip()
            if line.startswith('{') and line.endswith('}'):
                try:
                    item = json.loads(line)
                    results.append(LLMMatchResult(
                        receipt_item=item.get("item", ""),
                        suggested_match=item.get("match"),
                        confidence=float(item.get("confidence", 0.5)),
                        interpreted_name=item.get("interpreted")
                    ))
                except:
                    continue

    return results


async def enhance_ocr_text(
    raw_text: str,
    client: Optional[LLMClient] = None
) -> str:
    """
    Use LLM to clean and enhance raw OCR text.

    Corrects common OCR errors, normalizes spacing, etc.

    Args:
        raw_text: Raw text from OCR

    Returns:
        Enhanced/corrected text
    """
    if not raw_text or len(raw_text) < 10:
        return raw_text

    if client is None:
        client = await get_ocr_client()

    if client is None:
        return raw_text

    system_prompt = """Sei un correttore di testo OCR da scontrini italiani.
Correggi errori comuni di OCR mantenendo il significato:
- Caratteri scambiati (0/O, 1/l/I, 5/S)
- Spazi mancanti o extra
- Troncamenti errati

Mantieni le abbreviazioni originali, correggi solo errori evidenti.
Rispondi SOLO con il testo corretto, nient'altro."""

    response = await client.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": raw_text}
        ],
        temperature=0.1,
        max_tokens=len(raw_text) * 2
    )

    return response.strip() if response else raw_text
