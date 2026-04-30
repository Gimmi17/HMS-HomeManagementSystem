"""
Investments API
CRUD for investments, periodic snapshots, and linking finance entries to investments.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_house import UserHouse
from app.models.house import House
from app.models.investment import Investment, InvestmentSnapshot
from app.models.finance import FinanceEntry
from app.schemas.investment import (
    InvestmentCreate, InvestmentUpdate, InvestmentResponse,
    SnapshotCreate, SnapshotResponse,
    LinkEntryPayload,
)

router = APIRouter()


# ============================================================================
# HELPERS
# ============================================================================

def _get_house(user: User, db: Session) -> House:
    membership = (
        db.query(UserHouse)
        .filter(UserHouse.user_id == user.id)
        .order_by(UserHouse.created_at)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="No house found for user")
    house = db.query(House).filter(House.id == membership.house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    return house


def _get_investment(inv_id: UUID, user: User, house: House, db: Session) -> Investment:
    inv = db.query(Investment).filter(
        Investment.id == inv_id,
        Investment.user_id == user.id,
        Investment.house_id == house.id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    return inv


# ============================================================================
# INVESTMENTS CRUD
# ============================================================================

@router.get("/", response_model=List[InvestmentResponse])
def list_investments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    return (
        db.query(Investment)
        .filter(
            Investment.user_id == current_user.id,
            Investment.house_id == house.id,
        )
        .order_by(Investment.created_at.desc())
        .all()
    )


@router.post("/", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
def create_investment(
    payload: InvestmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    inv = Investment(
        user_id=current_user.id,
        house_id=house.id,
        **payload.dict(),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


@router.get("/{investment_id}", response_model=InvestmentResponse)
def get_investment(
    investment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    return _get_investment(investment_id, current_user, house, db)


@router.put("/{investment_id}", response_model=InvestmentResponse)
def update_investment(
    investment_id: UUID,
    payload: InvestmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    inv = _get_investment(investment_id, current_user, house, db)
    for field, value in payload.dict(exclude_none=True).items():
        setattr(inv, field, value)
    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/{investment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investment(
    investment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    inv = _get_investment(investment_id, current_user, house, db)
    db.delete(inv)
    db.commit()


# ============================================================================
# SNAPSHOTS
# ============================================================================

@router.get("/{investment_id}/snapshots", response_model=List[SnapshotResponse])
def list_snapshots(
    investment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    _get_investment(investment_id, current_user, house, db)
    return (
        db.query(InvestmentSnapshot)
        .filter(InvestmentSnapshot.investment_id == investment_id)
        .order_by(InvestmentSnapshot.snapshot_date.desc())
        .all()
    )


@router.post(
    "/{investment_id}/snapshots",
    response_model=SnapshotResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_snapshot(
    investment_id: UUID,
    payload: SnapshotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    _get_investment(investment_id, current_user, house, db)
    snap = InvestmentSnapshot(investment_id=investment_id, **payload.dict())
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


@router.delete(
    "/{investment_id}/snapshots/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_snapshot(
    investment_id: UUID,
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    _get_investment(investment_id, current_user, house, db)
    snap = db.query(InvestmentSnapshot).filter(
        InvestmentSnapshot.id == snapshot_id,
        InvestmentSnapshot.investment_id == investment_id,
    ).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    db.delete(snap)
    db.commit()


# ============================================================================
# LINK FINANCE ENTRY → INVESTMENT
# ============================================================================

@router.patch("/link-entry/{entry_id}")
def link_entry_to_investment(
    entry_id: UUID,
    payload: LinkEntryPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    entry = db.query(FinanceEntry).filter(
        FinanceEntry.id == entry_id,
        FinanceEntry.user_id == current_user.id,
        FinanceEntry.house_id == house.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if payload.investment_id:
        _get_investment(payload.investment_id, current_user, house, db)

    entry.investment_id = payload.investment_id
    db.commit()
    return {"ok": True, "investment_id": str(payload.investment_id) if payload.investment_id else None}


@router.get("/linked-entries/{investment_id}")
def get_linked_entries(
    investment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    house = _get_house(current_user, db)
    _get_investment(investment_id, current_user, house, db)
    entries = db.query(FinanceEntry).filter(
        FinanceEntry.investment_id == investment_id,
        FinanceEntry.user_id == current_user.id,
        FinanceEntry.house_id == house.id,
    ).all()
    return [
        {
            "id": str(e.id),
            "label": e.label,
            "amount": float(e.amount),
            "type": e.type,
            "subtype": e.subtype,
            "frequency": e.frequency,
        }
        for e in entries
    ]
