"""
Receipt Reconciliation Service
Match receipt items with shopping list items using fuzzy matching.

Features:
- Fuzzy string matching with RapidFuzz
- Italian product synonym handling
- Configurable matching thresholds
- Match status classification (matched, suggested, extra)
"""

import logging
from typing import Optional
from dataclasses import dataclass

from rapidfuzz import fuzz, process

from app.models.shopping_list import ShoppingListItem
from app.models.receipt import ReceiptItem, ReceiptItemMatchStatus

logger = logging.getLogger(__name__)


# Matching thresholds
AUTO_MATCH_THRESHOLD = 75  # >= 75% = automatic match
SUGGEST_THRESHOLD = 50     # 50-75% = suggest to user
# < 50% = extra (not in list)


@dataclass
class MatchResult:
    """Result of matching a receipt item to shopping list"""
    receipt_item_id: str
    shopping_list_item_id: Optional[str]
    match_status: ReceiptItemMatchStatus
    confidence: float
    matched_name: Optional[str] = None


# Italian product synonyms (common variations in receipts vs lists)
ITALIAN_SYNONYMS = {
    # Dairy
    'latte': ['latte fresco', 'latte intero', 'latte ps', 'latte parz screm', 'latte uht'],
    'yogurt': ['yog', 'yogurt greco', 'yogurt bianco', 'yogurt nat'],
    'parmigiano': ['parm', 'parmigiano reggiano', 'grana', 'grana padano'],
    'mozzarella': ['mozz', 'mozzarella buf', 'mozzarella bufala'],

    # Bread/Bakery
    'pane': ['pane fresco', 'pane bianco', 'pane integrale', 'panini', 'rosette'],
    'pasta': ['spaghetti', 'penne', 'fusilli', 'rigatoni', 'farfalle'],

    # Meat
    'pollo': ['petto pollo', 'cosce pollo', 'pollo intero', 'fesa pollo'],
    'manzo': ['carne bovina', 'macinato manzo', 'fettine manzo'],
    'maiale': ['carne suina', 'braciole', 'salsicce', 'salsiccia'],

    # Produce
    'pomodori': ['pomodoro', 'pomod', 'ciliegini', 'datterini', 'pachino'],
    'insalata': ['lattuga', 'iceberg', 'romana', 'rucola', 'valeriana'],
    'zucchine': ['zucchina', 'zucch'],
    'patate': ['patata', 'pat'],
    'cipolle': ['cipolla', 'cip'],
    'carote': ['carota', 'car'],
    'mele': ['mela', 'golden', 'fuji', 'granny'],
    'banane': ['banana', 'ban'],
    'arance': ['arancia', 'aranc'],

    # Beverages
    'acqua': ['acqua nat', 'acqua frizzante', 'acqua minerale', 'h2o'],
    'birra': ['birra chiara', 'birra scura', 'lager', 'pilsner'],
    'vino': ['vino rosso', 'vino bianco', 'rosso', 'bianco'],
    'caffe': ['caffe macinato', 'caffe cialde', 'espresso', 'caffe grani'],

    # Household
    'carta': ['carta igienica', 'carta casa', 'scottex', 'rotoloni'],
    'sapone': ['sapone mani', 'sapone liquido', 'detergente'],
    'detersivo': ['det piatti', 'det lavatrice', 'detersivo piatti'],
}


def normalize_text(text: str) -> str:
    """
    Normalize text for comparison.
    - Lowercase
    - Remove accents (simplified)
    - Remove extra whitespace
    """
    if not text:
        return ""

    text = text.lower().strip()

    # Simple accent removal
    accent_map = {
        'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u',
        'À': 'a', 'È': 'e', 'É': 'e', 'Ì': 'i', 'Ò': 'o', 'Ù': 'u'
    }
    for accent, plain in accent_map.items():
        text = text.replace(accent, plain)

    # Normalize whitespace
    text = ' '.join(text.split())

    return text


def expand_with_synonyms(text: str) -> list[str]:
    """
    Expand a product name with its synonyms.
    Returns a list of possible names.
    """
    normalized = normalize_text(text)
    results = [normalized]

    for base, synonyms in ITALIAN_SYNONYMS.items():
        # If text contains the base word, add synonyms
        if base in normalized:
            for syn in synonyms:
                results.append(normalized.replace(base, syn))

        # If text contains a synonym, add the base word
        for syn in synonyms:
            if syn in normalized:
                results.append(normalized.replace(syn, base))
                break

    return list(set(results))


def calculate_match_score(
    receipt_text: str,
    shopping_list_text: str
) -> float:
    """
    Calculate matching score between receipt item and shopping list item.
    Uses multiple fuzzy matching strategies and returns the best score.
    """
    # Normalize texts
    receipt_normalized = normalize_text(receipt_text)
    shopping_normalized = normalize_text(shopping_list_text)

    if not receipt_normalized or not shopping_normalized:
        return 0.0

    # Get expanded versions with synonyms
    receipt_variants = expand_with_synonyms(receipt_normalized)
    shopping_variants = expand_with_synonyms(shopping_normalized)

    best_score = 0.0

    for r_text in receipt_variants:
        for s_text in shopping_variants:
            # Try different matching algorithms
            scores = [
                fuzz.ratio(r_text, s_text),
                fuzz.partial_ratio(r_text, s_text),
                fuzz.token_sort_ratio(r_text, s_text),
                fuzz.token_set_ratio(r_text, s_text),
            ]
            best_score = max(best_score, max(scores))

    return best_score


def find_best_match(
    receipt_item_name: str,
    shopping_list_items: list[ShoppingListItem]
) -> tuple[Optional[ShoppingListItem], float]:
    """
    Find the best matching shopping list item for a receipt item.

    Returns (best_match, score) tuple.
    """
    if not shopping_list_items or not receipt_item_name:
        return None, 0.0

    best_match = None
    best_score = 0.0

    for item in shopping_list_items:
        score = calculate_match_score(receipt_item_name, item.name)

        # Also try matching against grocy_product_name if available
        if item.grocy_product_name:
            grocy_score = calculate_match_score(receipt_item_name, item.grocy_product_name)
            score = max(score, grocy_score)

        if score > best_score:
            best_score = score
            best_match = item

    return best_match, best_score


def classify_match(score: float) -> ReceiptItemMatchStatus:
    """
    Classify match based on confidence score.
    """
    if score >= AUTO_MATCH_THRESHOLD:
        return ReceiptItemMatchStatus.MATCHED
    elif score >= SUGGEST_THRESHOLD:
        return ReceiptItemMatchStatus.UNMATCHED  # Will show as suggestion
    else:
        return ReceiptItemMatchStatus.EXTRA


def reconcile_receipt_items(
    receipt_items: list[ReceiptItem],
    shopping_list_items: list[ShoppingListItem]
) -> list[MatchResult]:
    """
    Reconcile receipt items against shopping list items.

    Returns list of MatchResult with match status for each receipt item.
    """
    results = []

    # Track which shopping list items have been matched
    matched_shopping_items = set()

    # First pass: find all best matches
    for receipt_item in receipt_items:
        item_name = receipt_item.parsed_name or receipt_item.raw_text

        # Filter out already matched items
        available_items = [
            item for item in shopping_list_items
            if item.id not in matched_shopping_items
        ]

        best_match, score = find_best_match(item_name, available_items)

        status = classify_match(score)

        # If auto-matched, mark shopping item as used
        if status == ReceiptItemMatchStatus.MATCHED and best_match:
            matched_shopping_items.add(best_match.id)

        results.append(MatchResult(
            receipt_item_id=str(receipt_item.id),
            shopping_list_item_id=str(best_match.id) if best_match and score >= SUGGEST_THRESHOLD else None,
            match_status=status,
            confidence=score,
            matched_name=best_match.name if best_match else None
        ))

    return results


def get_unmatched_shopping_items(
    shopping_list_items: list[ShoppingListItem],
    match_results: list[MatchResult]
) -> list[ShoppingListItem]:
    """
    Get shopping list items that were not matched by any receipt item.
    These are items that were expected but not found on the receipt.
    """
    matched_ids = {
        result.shopping_list_item_id
        for result in match_results
        if result.match_status == ReceiptItemMatchStatus.MATCHED and result.shopping_list_item_id
    }

    return [
        item for item in shopping_list_items
        if str(item.id) not in matched_ids
    ]


def get_reconciliation_summary(
    receipt_items: list[ReceiptItem],
    shopping_list_items: list[ShoppingListItem],
    match_results: list[MatchResult]
) -> dict:
    """
    Generate a summary of the reconciliation.
    """
    matched = [r for r in match_results if r.match_status == ReceiptItemMatchStatus.MATCHED]
    suggested = [r for r in match_results if r.match_status == ReceiptItemMatchStatus.UNMATCHED and r.shopping_list_item_id]
    extra = [r for r in match_results if r.match_status == ReceiptItemMatchStatus.EXTRA]
    unmatched_shopping = get_unmatched_shopping_items(shopping_list_items, match_results)

    return {
        "total_receipt_items": len(receipt_items),
        "total_shopping_items": len(shopping_list_items),
        "matched_count": len(matched),
        "suggested_count": len(suggested),
        "extra_count": len(extra),
        "missing_count": len(unmatched_shopping),
        "match_rate": len(matched) / len(shopping_list_items) * 100 if shopping_list_items else 0
    }
