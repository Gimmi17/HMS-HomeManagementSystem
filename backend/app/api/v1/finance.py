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
from app.models.finance import FinanceEntry, FinanceSavings, RevolutMovement
from app.schemas.finance import (
    FinanceEntryCreate, FinanceEntryUpdate, FinanceEntryResponse,
    FinanceSavingsPayload, FinanceSavingsResponse,
    RevolutMovementCreate, RevolutMovementResponse,
    OCREntryParsed, HouseMemberSummary, HouseFinanceSummary,
)

router = APIRouter()


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
    entry = FinanceEntry(
        user_id=current_user.id,
        house_id=house_id,
        **data.model_dump(exclude_none=True),
    )
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
    mov = RevolutMovement(
        user_id=current_user.id,
        house_id=house_id,
        **data.model_dump(),
    )
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
_DATE_RE = re.compile(r"(\d{2})/(\d{2})/(\d{4})")
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
    m = _DATE_RE.search(s)
    if not m:
        return None
    try:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return date_cls(y, mo, d)
    except ValueError:
        return None


@router.post("/import/ocr", response_model=list[OCREntryParsed])
async def import_ocr(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
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

    text = pytesseract.image_to_string(img, lang="ita+eng")
    results: list[OCREntryParsed] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        amount_m = _AMOUNT_RE.search(line)
        if not amount_m:
            continue
        amount = _parse_amount(amount_m.group(1))
        if amount is None or amount == 0:
            continue
        parsed_date = _parse_date(line)
        lower = line.lower()
        is_income = any(kw in lower for kw in _INCOME_KEYWORDS) or amount > 0 and "-" not in amount_m.group(1)
        # Fallback: amount sign dictates type
        if amount < 0:
            is_income = False
        entry_type = "income" if is_income else "expense"
        label = line.replace(amount_m.group(1), "").strip(" -•·\t")
        if parsed_date:
            label = _DATE_RE.sub("", label).strip(" -•·\t")
        label = label[:255] or "Movimento"
        results.append(
            OCREntryParsed(
                label=label,
                amount=abs(amount),
                type=entry_type,
                date=parsed_date,
                subtype="done",
            )
        )

    return results


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
