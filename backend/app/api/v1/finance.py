"""
Finance API
Personal finance CRUD plus Revolut movements, OCR import and house aggregate.
"""

from typing import Optional
from uuid import UUID
from datetime import date as date_cls
from io import BytesIO
import re

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_house import UserHouse
from app.models.house import House
from app.models.finance import FinanceLabel, FinanceEntity, FinanceSource, FinanceEntry, FinanceSavings, RevolutMovement
from app.schemas.finance import (
    FinanceEntryCreate, FinanceEntryUpdate, FinanceEntryResponse,
    FinanceSavingsPayload, FinanceSavingsResponse,
    RevolutMovementCreate, RevolutMovementResponse,
    OCREntryParsed, HouseMemberSummary, HouseFinanceSummary,
    FinanceLabelResponse, FinanceEntityCreate, FinanceEntityResponse,
    FinanceSourceCreate, FinanceSourceResponse,
)

router = APIRouter()


# ============================================================================
# ENTITY AUTO-DETECT
# ============================================================================

_MERCHANT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bamazon\b", re.IGNORECASE), "Amazon"),
    (re.compile(r"\bpaypal\b", re.IGNORECASE), "PayPal"),
    (re.compile(r"\bmcdonald['s]?\b|mcdonald\b", re.IGNORECASE), "McDonald's"),
    (re.compile(r"\bnetflix\b", re.IGNORECASE), "Netflix"),
    (re.compile(r"\bspotify\b", re.IGNORECASE), "Spotify"),
    (re.compile(r"\bapple\b", re.IGNORECASE), "Apple"),
    (re.compile(r"\bgoogle\b", re.IGNORECASE), "Google"),
    (re.compile(r"\bubereats\b|uber\s*eats\b", re.IGNORECASE), "Uber Eats"),
    (re.compile(r"\buber\b", re.IGNORECASE), "Uber"),
    (re.compile(r"\bglovo\b", re.IGNORECASE), "Glovo"),
    (re.compile(r"\bjust\s*eat\b", re.IGNORECASE), "Just Eat"),
    (re.compile(r"\bdeliveroo\b", re.IGNORECASE), "Deliveroo"),
    (re.compile(r"\bzara\b", re.IGNORECASE), "Zara"),
    (re.compile(r"\bikea\b", re.IGNORECASE), "IKEA"),
    (re.compile(r"\besselunga\b", re.IGNORECASE), "Esselunga"),
    (re.compile(r"\bcarrefour\b", re.IGNORECASE), "Carrefour"),
    (re.compile(r"\bconad\b", re.IGNORECASE), "Conad"),
    (re.compile(r"\beurospin\b", re.IGNORECASE), "Eurospin"),
    (re.compile(r"\blidl\b", re.IGNORECASE), "Lidl"),
    (re.compile(r"\baldi\b", re.IGNORECASE), "Aldi"),
    (re.compile(r"\bpenny\b", re.IGNORECASE), "Penny"),
    (re.compile(r"\bstarbucks\b", re.IGNORECASE), "Starbucks"),
    (re.compile(r"\bburgerkingking\b|burger\s*king\b", re.IGNORECASE), "Burger King"),
    (re.compile(r"\btrenitalia\b", re.IGNORECASE), "Trenitalia"),
    (re.compile(r"\bitalo\b", re.IGNORECASE), "Italo"),
    (re.compile(r"\batipoliti\b", re.IGNORECASE), "Atipoliti"),
    (re.compile(r"\bh&m\b|h\s*and\s*m\b", re.IGNORECASE), "H&M"),
    (re.compile(r"\bprimark\b", re.IGNORECASE), "Primark"),
    (re.compile(r"\bdecathlon\b", re.IGNORECASE), "Decathlon"),
    (re.compile(r"\bmedia\s*world\b", re.IGNORECASE), "MediaWorld"),
    (re.compile(r"\bunieuro\b", re.IGNORECASE), "Unieuro"),
    (re.compile(r"\biryo\b", re.IGNORECASE), "Iryo"),
    (re.compile(r"\bryanair\b", re.IGNORECASE), "Ryanair"),
    (re.compile(r"\beasyjet\b", re.IGNORECASE), "easyJet"),
    (re.compile(r"\bwizzair\b|wizz\s*air\b", re.IGNORECASE), "Wizz Air"),
    (re.compile(r"\bluminance\b", re.IGNORECASE), "Luminance"),
    (re.compile(r"\bwolt\b", re.IGNORECASE), "Wolt"),
]


def _detect_entity(text: str) -> Optional[str]:
    for pattern, name in _MERCHANT_PATTERNS:
        if pattern.search(text):
            return name
    return None


def _get_or_create_label(db: Session, name: str) -> FinanceLabel:
    from sqlalchemy import func
    lbl = db.query(FinanceLabel).filter(
        func.lower(FinanceLabel.name) == name.lower()
    ).first()
    if not lbl:
        lbl = FinanceLabel(name=name)
        db.add(lbl)
        db.flush()
    return lbl


def _get_or_create_entity(db: Session, name: str) -> FinanceEntity:
    from sqlalchemy import func
    ent = db.query(FinanceEntity).filter(
        func.lower(FinanceEntity.name) == name.lower()
    ).first()
    if not ent:
        ent = FinanceEntity(name=name)
        db.add(ent)
        db.flush()
    return ent


def _get_or_create_source(db: Session, name: str) -> FinanceSource:
    from sqlalchemy import func
    src = db.query(FinanceSource).filter(
        func.lower(FinanceSource.name) == name.lower()
    ).first()
    if not src:
        src = FinanceSource(name=name)
        db.add(src)
        db.flush()
    return src


def _primary_house_id(db: Session, user: User) -> UUID:
    membership = (
        db.query(UserHouse)
        .filter(UserHouse.user_id == user.id)
        .order_by(UserHouse.joined_at.asc())
        .first()
    )
    if not membership:
        raise HTTPException(status_code=400, detail="Utente senza casa associata")
    return membership.house_id


def _monthly_amount(e: FinanceEntry, today: Optional[date_cls] = None) -> float:
    if e.subtype != "recurring":
        return 0.0
    today = today or date_cls.today()
    if e.end_date and e.end_date < today:
        return 0.0
    if e.start_date and e.start_date > today:
        return 0.0
    amt = float(e.amount or 0)
    if e.frequency == "monthly":
        return amt
    if e.frequency == "weekly":
        return amt * 4.33
    if e.frequency == "every_n_months" and e.frequency_n and e.frequency_n > 0:
        return amt / float(e.frequency_n)
    return amt


# ============================================================================
# ENTRIES
# ============================================================================

@router.get("/entries", response_model=list[FinanceEntryResponse])
def list_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    rows = (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.user_id == current_user.id,
            FinanceEntry.house_id == house_id,
        )
        .order_by(FinanceEntry.created_at.desc())
        .all()
    )
    return rows


@router.post("/entries", response_model=FinanceEntryResponse, status_code=201)
def create_entry(
    data: FinanceEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    entry_data = data.model_dump(exclude_none=True)
    # Auto-normalize label → label_id
    lbl = _get_or_create_label(db, data.label)
    entry_data["label_id"] = lbl.id
    # Auto-normalize entity_name → entity_id
    entity_name = entry_data.pop("entity_name", None)
    if entity_name and not entry_data.get("entity_id"):
        ent = _get_or_create_entity(db, entity_name)
        entry_data["entity_id"] = ent.id
    # Auto-normalize source_name → source_id
    source_name = entry_data.pop("source_name", None)
    if source_name and not entry_data.get("source_id"):
        src = _get_or_create_source(db, source_name)
        entry_data["source_id"] = src.id
    entry = FinanceEntry(user_id=current_user.id, house_id=house_id, **entry_data)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(FinanceEntry)
        .filter(FinanceEntry.id == entry_id, FinanceEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry non trovata")
    db.delete(entry)
    db.commit()
    return None


@router.patch("/entries/{entry_id}", response_model=FinanceEntryResponse)
def update_entry(
    entry_id: UUID,
    data: FinanceEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = (
        db.query(FinanceEntry)
        .filter(FinanceEntry.id == entry_id, FinanceEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry non trovata")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


# ============================================================================
# SAVINGS
# ============================================================================

@router.get("/savings", response_model=FinanceSavingsResponse)
def get_savings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    s = (
        db.query(FinanceSavings)
        .filter(
            FinanceSavings.user_id == current_user.id,
            FinanceSavings.house_id == house_id,
        )
        .first()
    )
    if not s:
        return FinanceSavingsResponse(amount=0, resign_date=None)
    return FinanceSavingsResponse(
        amount=float(s.amount or 0),
        resign_date=s.resign_date,
    )


@router.post("/savings", response_model=FinanceSavingsResponse)
def upsert_savings(
    data: FinanceSavingsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    s = (
        db.query(FinanceSavings)
        .filter(
            FinanceSavings.user_id == current_user.id,
            FinanceSavings.house_id == house_id,
        )
        .first()
    )
    if s:
        s.amount = data.amount
        s.resign_date = data.resign_date
    else:
        s = FinanceSavings(
            user_id=current_user.id,
            house_id=house_id,
            amount=data.amount,
            resign_date=data.resign_date,
        )
        db.add(s)
    db.commit()
    db.refresh(s)
    return FinanceSavingsResponse(
        amount=float(s.amount or 0),
        resign_date=s.resign_date,
    )


# ============================================================================
# LABELS
# ============================================================================

@router.get("/labels", response_model=list[FinanceLabelResponse])
def list_labels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FinanceLabel).order_by(FinanceLabel.name).all()


# ============================================================================
# ENTITIES
# ============================================================================

@router.get("/entities", response_model=list[FinanceEntityResponse])
def list_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FinanceEntity).order_by(FinanceEntity.name).all()


@router.post("/entities", response_model=FinanceEntityResponse, status_code=201)
def create_entity(
    data: FinanceEntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ent = _get_or_create_entity(db, data.name)
    if data.category is not None:
        ent.category = data.category
    db.commit()
    db.refresh(ent)
    return ent


@router.delete("/entities/{entity_id}", status_code=204)
def delete_entity(
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ent = db.query(FinanceEntity).filter(FinanceEntity.id == entity_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Entità non trovata")
    db.delete(ent)
    db.commit()
    return None


# ============================================================================
# REVOLUT MOVEMENTS
# ============================================================================

@router.get("/revolut", response_model=list[RevolutMovementResponse])
def list_revolut(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    rows = (
        db.query(RevolutMovement)
        .filter(
            RevolutMovement.user_id == current_user.id,
            RevolutMovement.house_id == house_id,
        )
        .order_by(RevolutMovement.date.desc())
        .all()
    )
    return rows


@router.post("/revolut", response_model=RevolutMovementResponse, status_code=201)
def create_revolut(
    data: RevolutMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    mov_data = data.model_dump()
    # Auto-normalize label → label_id
    lbl = _get_or_create_label(db, data.label)
    mov_data["label_id"] = lbl.id
    # Auto-normalize entity_name → entity_id if provided as string
    entity_name = mov_data.pop("entity_name", None)
    if entity_name and not mov_data.get("entity_id"):
        ent = _get_or_create_entity(db, entity_name)
        mov_data["entity_id"] = ent.id
    # Auto-set source to "Revolut" unless overridden via source_name
    source_name = mov_data.pop("source_name", None) or "Revolut"
    if not mov_data.get("source_id"):
        src = _get_or_create_source(db, source_name)
        mov_data["source_id"] = src.id
    mov = RevolutMovement(user_id=current_user.id, house_id=house_id, **mov_data)
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov


@router.delete("/revolut/{mov_id}", status_code=204)
def delete_revolut(
    mov_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mov = (
        db.query(RevolutMovement)
        .filter(RevolutMovement.id == mov_id, RevolutMovement.user_id == current_user.id)
        .first()
    )
    if not mov:
        raise HTTPException(status_code=404, detail="Movimento non trovato")
    db.delete(mov)
    db.commit()
    return None


# ============================================================================
# OCR IMPORT
# ============================================================================

_AMOUNT_RE = re.compile(r"(-?\s*€?\s*\d{1,3}(?:[.\s]\d{3})*,\d{2})")
_DATE_RE_FULL = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
_DATE_RE_SHORT = re.compile(r"(\d{1,2})/(\d{2})")
_IT_MONTHS = {
    "gennaio": 1, "febbraio": 2, "marzo": 3, "aprile": 4,
    "maggio": 5, "giugno": 6, "luglio": 7, "agosto": 8,
    "settembre": 9, "ottobre": 10, "novembre": 11, "dicembre": 12,
}
_DATE_RE_WORD = re.compile(r"(\d{1,2})\s+(" + "|".join(_IT_MONTHS.keys()) + r")\b", re.IGNORECASE)
_DATE_RE = _DATE_RE_FULL
_INCOME_KEYWORDS = ("accredito", "emolumenti", "stipendio", "bonifico in")


def _parse_amount(s: str) -> Optional[float]:
    raw = s.strip().replace("€", "").replace(" ", "")
    sign = 1.0
    if raw.startswith("-"):
        sign = -1.0
        raw = raw[1:]
    raw = raw.replace(".", "").replace(",", ".")
    try:
        return sign * float(raw)
    except ValueError:
        return None


def _parse_date(s: str) -> Optional[date_cls]:
    today = date_cls.today()
    # DD/MM/YYYY
    m = _DATE_RE_FULL.search(s)
    if m:
        try:
            return date_cls(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass
    # DD nome_mese (es. "28 marzo", "13 aprile")
    mw = _DATE_RE_WORD.search(s)
    if mw:
        try:
            d = int(mw.group(1))
            mo = _IT_MONTHS[mw.group(2).lower()]
            y = today.year
            return date_cls(y, mo, d)
        except ValueError:
            pass
    # DD/MM (senza anno)
    ms = _DATE_RE_SHORT.search(s)
    if ms:
        try:
            d, mo = int(ms.group(1)), int(ms.group(2))
            y = today.year
            return date_cls(y, mo, d)
        except ValueError:
            pass
    return None


@router.post("/import/ocr", response_model=list[OCREntryParsed])
@router.post("/import/mediolanum", response_model=list[OCREntryParsed])
async def import_ocr(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Import Screenshot Mediolanum.

    Mediolanum layout:
        Left column:  Description   |  Right column: ±Amount
                      DD/MM/YYYY    |                (Rateizzabile)
        ─────────────────────────────────────────────────────────

    Tesseract reads columns independently, so we use image_to_data
    bounding-box positions to match description + amount by Y coordinate.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Dipendenze OCR non installate (pytesseract, Pillow)",
        )

    content = await file.read()
    try:
        img = Image.open(BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Immagine non valida: {exc}")

    img_w = img.width
    split_x = int(img_w * 0.55)  # left/right column boundary
    y_tol = 40  # pixels tolerance to consider two words on the same row

    data = pytesseract.image_to_data(img, lang="ita+eng", output_type=pytesseract.Output.DICT)

    # Build list of (x, y, text) for words with reasonable confidence
    words = []
    for i in range(len(data["text"])):
        t = (data["text"][i] or "").strip()
        if not t:
            continue
        try:
            conf = int(data["conf"][i])
        except (ValueError, TypeError):
            conf = 0
        if conf < 15:
            continue
        words.append({
            "x": data["left"][i],
            "y": data["top"][i],
            "w": data["width"][i],
            "text": t,
        })

    # Group words into horizontal rows by Y proximity
    rows: list[list[dict]] = []
    for wd in sorted(words, key=lambda w: w["y"]):
        placed = False
        for row in rows:
            if abs(wd["y"] - row[0]["y"]) <= y_tol:
                row.append(wd)
                placed = True
                break
        if not placed:
            rows.append([wd])

    # Sort rows top-to-bottom and words within each row left-to-right
    rows.sort(key=lambda r: r[0]["y"])
    for r in rows:
        r.sort(key=lambda w: w["x"])

    def _row_text_left(row: list[dict]) -> str:
        return " ".join(w["text"] for w in row if w["x"] < split_x)

    def _row_text_right(row: list[dict]) -> str:
        return " ".join(w["text"] for w in row if w["x"] >= split_x)

    _SKIP_LABELS = re.compile(r"rateizzabile", re.IGNORECASE)

    results: list[OCREntryParsed] = []

    for i, row in enumerate(rows):
        right_text = _row_text_right(row)
        # Skip "Rateizzabile" rows
        if _SKIP_LABELS.search(right_text):
            continue

        # Try to find an amount in the right column
        amount_m = _AMOUNT_RE.search(right_text)
        if not amount_m:
            continue

        amount = _parse_amount(amount_m.group(1))
        if amount is None or amount == 0:
            continue

        # Description: left column of this row
        left_text = _row_text_left(row)
        # Clean "€" or stray signs from label
        label = left_text.strip(" €+-•·\t") or "Movimento"
        label = label[:255]

        # Date: look in next 1-3 rows for a date in the left column
        parsed_date: Optional[date_cls] = None
        for fwd in range(1, 4):
            if i + fwd >= len(rows):
                break
            next_row = rows[i + fwd]
            next_right = _row_text_right(next_row)
            # Stop if the next row is another transaction (has amount on right)
            if _AMOUNT_RE.search(next_right) and not _SKIP_LABELS.search(next_right):
                break
            next_left = _row_text_left(next_row)
            d = _parse_date(next_left) or _parse_date(_row_text_right(next_row))
            if d:
                parsed_date = d
                break

        # Income detection
        ctx = (label + " " + right_text).lower()
        is_income = any(kw in ctx for kw in _INCOME_KEYWORDS)
        if not is_income:
            is_income = amount > 0 and "-" not in amount_m.group(1)
        if amount < 0:
            is_income = False
        entry_type = "income" if is_income else "expense"

        # Entity auto-detection
        entity_name = _detect_entity(label + " " + right_text)

        results.append(
            OCREntryParsed(
                label=label,
                amount=abs(amount),
                type=entry_type,
                tx_date=parsed_date,
                subtype="done",
                entity=entity_name,
                source="Mediolanum",
            )
        )

    return results


# ============================================================================
# SOURCES
# ============================================================================

@router.get("/sources", response_model=list[FinanceSourceResponse])
def list_sources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FinanceSource).order_by(FinanceSource.name).all()


@router.post("/sources", response_model=FinanceSourceResponse, status_code=201)
def create_source(
    data: FinanceSourceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    src = _get_or_create_source(db, data.name)
    if data.description is not None:
        src.description = data.description
    db.commit()
    db.refresh(src)
    return src


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(
    source_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    src = db.query(FinanceSource).filter(FinanceSource.id == source_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Sorgente non trovata")
    db.delete(src)
    db.commit()
    return None


# ============================================================================
# HOUSE SUMMARY
# ============================================================================

@router.get("/house/summary", response_model=HouseFinanceSummary)
def house_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house_id = _primary_house_id(db, current_user)
    members_rows = (
        db.query(UserHouse, User)
        .join(User, User.id == UserHouse.user_id)
        .filter(UserHouse.house_id == house_id)
        .all()
    )

    today = date_cls.today()
    members_summary: list[HouseMemberSummary] = []
    tot_income = 0.0
    tot_expense = 0.0
    tot_savings = 0.0
    tot_leftover = 0.0

    for _membership, user in members_rows:
        entries = (
            db.query(FinanceEntry)
            .filter(
                FinanceEntry.user_id == user.id,
                FinanceEntry.house_id == house_id,
                FinanceEntry.subtype == "recurring",
            )
            .all()
        )
        income = sum(_monthly_amount(e, today) for e in entries if e.type == "income")
        expense = sum(_monthly_amount(e, today) for e in entries if e.type == "expense")
        leftover = income - expense

        savings_row = (
            db.query(FinanceSavings)
            .filter(
                FinanceSavings.user_id == user.id,
                FinanceSavings.house_id == house_id,
            )
            .first()
        )
        savings = float(savings_row.amount) if savings_row and savings_row.amount else 0.0

        members_summary.append(
            HouseMemberSummary(
                user_id=user.id,
                name=user.full_name or user.email,
                monthly_income=round(income, 2),
                monthly_expense=round(expense, 2),
                leftover=round(leftover, 2),
                savings=round(savings, 2),
            )
        )
        tot_income += income
        tot_expense += expense
        tot_savings += savings
        tot_leftover += leftover

    return HouseFinanceSummary(
        members=members_summary,
        total_income=round(tot_income, 2),
        total_expense=round(tot_expense, 2),
        total_savings=round(tot_savings, 2),
        total_leftover=round(tot_leftover, 2),
    )
