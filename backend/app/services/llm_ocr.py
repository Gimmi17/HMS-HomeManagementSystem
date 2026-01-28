"""
LLM-powered OCR Enhancement Service

Uses configured LLM to improve receipt OCR results:
- Interpret abbreviated product names
- Smart matching between receipt items and shopping list
- Correct OCR errors
"""

import json
import logging
from typing import Optional
from dataclasses import dataclass

from app.integrations.llm import get_ocr_client, LLMClient

logger = logging.getLogger(__name__)


@dataclass
class LLMMatchResult:
    """Result of LLM-powered matching"""
    receipt_item: str
    suggested_match: Optional[str]
    confidence: float
    interpreted_name: Optional[str] = None  # Full interpretation of abbreviation


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
