"""
Health API Endpoints
Provides CRUD operations for health tracking (weights and health records).

Endpoints:
    Weights:
        - POST   /weights - Create weight measurement
        - GET    /weights - List weights with filters
        - GET    /weights/{id} - Get single weight
        - PUT    /weights/{id} - Update weight
        - DELETE /weights/{id} - Delete weight

    Health Records:
        - POST   /health - Create health record
        - GET    /health - List health records with filters
        - GET    /health/{id} - Get single health record
        - PUT    /health/{id} - Update health record
        - DELETE /health/{id} - Delete health record

All endpoints require authentication and enforce house-level access control.
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, distinct

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_house import UserHouse
from app.models.biometric_profile import BiometricProfile
from app.models.biometric_log import BiometricLog
from app.models.health_goal import HealthGoal
from app.schemas.biometric import (
    BiometricProfileCreate, BiometricProfileUpdate, BiometricProfileResponse,
    BiometricLogCreate, BiometricLogUpdate, BiometricLogResponse, BiometricLogListResponse,
    HealthGoalCreate, HealthGoalUpdate, HealthGoalResponse,
    BiometricDashboardResponse,
)
from app.schemas.health import (
    WeightCreate,
    WeightUpdate,
    WeightResponse,
    WeightListResponse,
    HealthRecordCreate,
    HealthRecordUpdate,
    HealthRecordResponse,
    HealthRecordListResponse,
    HealthDashboardResponse
)
from app.services import health_service

router = APIRouter(tags=["health"])


def verify_house_membership(db: Session, user_id: UUID, house_id: UUID) -> UserHouse:
    """Verify that user belongs to the specified house."""
    membership = db.query(UserHouse).filter(
        UserHouse.user_id == user_id,
        UserHouse.house_id == house_id
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Non sei membro di questa casa"
        )

    return membership


# ============================================================================
# WEIGHT ENDPOINTS
# ============================================================================

@router.post("/weights", response_model=WeightResponse, status_code=status.HTTP_201_CREATED)
def create_weight(
    weight_data: WeightCreate,
    house_id: UUID = Query(..., description="House ID for the weight record"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new weight measurement."""
    verify_house_membership(db, current_user.id, house_id)

    weight = health_service.create_weight(
        db=db,
        user_id=current_user.id,
        house_id=house_id,
        weight_data=weight_data
    )

    return weight


@router.get("/weights", response_model=WeightListResponse)
def list_weights(
    house_id: UUID = Query(..., description="House ID to filter by"),
    user_id: Optional[UUID] = Query(None, description="User ID to filter by (optional)"),
    from_date: Optional[datetime] = Query(None, description="Start date for range filter"),
    to_date: Optional[datetime] = Query(None, description="End date for range filter"),
    limit: int = Query(100, ge=1, le=500, description="Maximum results (1-500)"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List weight measurements with filters."""
    verify_house_membership(db, current_user.id, house_id)

    weights, total = health_service.get_weights(
        db=db,
        house_id=house_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset
    )

    return WeightListResponse(
        weights=weights,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/weights/{weight_id}", response_model=WeightResponse)
def get_weight(
    weight_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single weight measurement by ID."""
    verify_house_membership(db, current_user.id, house_id)

    weight = health_service.get_weight_by_id(db=db, weight_id=weight_id, house_id=house_id)

    if not weight:
        raise HTTPException(
            status_code=404,
            detail=f"Weight record {weight_id} not found in house {house_id}"
        )

    return weight


@router.put("/weights/{weight_id}", response_model=WeightResponse)
def update_weight(
    weight_id: UUID,
    weight_data: WeightUpdate,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing weight measurement."""
    verify_house_membership(db, current_user.id, house_id)

    weight = health_service.update_weight(
        db=db,
        weight_id=weight_id,
        house_id=house_id,
        weight_data=weight_data
    )

    if not weight:
        raise HTTPException(
            status_code=404,
            detail=f"Weight record {weight_id} not found"
        )

    return weight


@router.delete("/weights/{weight_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_weight(
    weight_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a weight measurement."""
    verify_house_membership(db, current_user.id, house_id)

    success = health_service.delete_weight(db=db, weight_id=weight_id, house_id=house_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Weight record {weight_id} not found"
        )

    # Return 204 No Content (no response body)
    return None


# ============================================================================
# HEALTH RECORD ENDPOINTS
# ============================================================================

@router.post("/health", response_model=HealthRecordResponse, status_code=status.HTTP_201_CREATED)
def create_health_record(
    record_data: HealthRecordCreate,
    house_id: UUID = Query(..., description="House ID for the health record"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new health record."""
    verify_house_membership(db, current_user.id, house_id)

    record = health_service.create_health_record(
        db=db,
        user_id=current_user.id,
        house_id=house_id,
        record_data=record_data
    )

    return record


@router.get("/health", response_model=HealthRecordListResponse)
def list_health_records(
    house_id: UUID = Query(..., description="House ID to filter by"),
    user_id: Optional[UUID] = Query(None, description="User ID to filter by"),
    type_filter: Optional[str] = Query(None, alias="type", description="Event type filter"),
    severity_filter: Optional[str] = Query(None, alias="severity", description="Severity filter"),
    from_date: Optional[datetime] = Query(None, description="Start date filter"),
    to_date: Optional[datetime] = Query(None, description="End date filter"),
    limit: int = Query(100, ge=1, le=500, description="Max results"),
    offset: int = Query(0, ge=0, description="Results to skip"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List health records with filters."""
    verify_house_membership(db, current_user.id, house_id)

    records, total = health_service.get_health_records(
        db=db,
        house_id=house_id,
        user_id=user_id,
        type_filter=type_filter,
        severity_filter=severity_filter,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset
    )

    return HealthRecordListResponse(
        records=records,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/health/{record_id}", response_model=HealthRecordResponse)
def get_health_record(
    record_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single health record by ID."""
    verify_house_membership(db, current_user.id, house_id)
    record = health_service.get_health_record_by_id(db=db, record_id=record_id, house_id=house_id)

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Health record {record_id} not found"
        )

    return record


@router.put("/health/{record_id}", response_model=HealthRecordResponse)
def update_health_record(
    record_id: UUID,
    record_data: HealthRecordUpdate,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing health record."""
    verify_house_membership(db, current_user.id, house_id)
    record = health_service.update_health_record(
        db=db,
        record_id=record_id,
        house_id=house_id,
        record_data=record_data
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail=f"Health record {record_id} not found"
        )

    return record


@router.delete("/health/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_health_record(
    record_id: UUID,
    house_id: UUID = Query(..., description="House ID for security verification"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a health record."""
    verify_house_membership(db, current_user.id, house_id)
    success = health_service.delete_health_record(db=db, record_id=record_id, house_id=house_id)

    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Health record {record_id} not found"
        )

    return None


# ============================================================================
# ANALYTICS ENDPOINTS (Optional)
# ============================================================================

# ============================================================================
# BIOMETRIC PROFILE ENDPOINTS
# ============================================================================

@router.get("/biometric-profile/{house_id}", response_model=BiometricProfileResponse)
def get_biometric_profile(
    house_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    profile = db.query(BiometricProfile).filter(
        BiometricProfile.user_id == current_user.id,
        BiometricProfile.house_id == house_id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profilo biometrico non trovato")
    return profile


@router.post("/biometric-profile/{house_id}", response_model=BiometricProfileResponse, status_code=201)
def create_biometric_profile(
    house_id: UUID,
    data: BiometricProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    existing = db.query(BiometricProfile).filter(
        BiometricProfile.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Profilo biometrico già esistente, usa PUT per aggiornare")
    profile = BiometricProfile(
        user_id=current_user.id,
        house_id=house_id,
        **data.model_dump(exclude_none=True),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/biometric-profile/{house_id}", response_model=BiometricProfileResponse)
def update_biometric_profile(
    house_id: UUID,
    data: BiometricProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    profile = db.query(BiometricProfile).filter(
        BiometricProfile.user_id == current_user.id,
        BiometricProfile.house_id == house_id,
    ).first()
    if not profile:
        # Auto-create on PUT if missing
        profile = BiometricProfile(
            user_id=current_user.id,
            house_id=house_id,
        )
        db.add(profile)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


# ============================================================================
# BIOMETRIC LOG ENDPOINTS
# ============================================================================

@router.post("/biometric-logs/{house_id}", response_model=BiometricLogResponse, status_code=201)
def create_biometric_log(
    house_id: UUID,
    data: BiometricLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    log = BiometricLog(
        user_id=current_user.id,
        house_id=house_id,
        metric=data.metric,
        value=data.value,
        unit=data.unit,
        source=data.source,
        notes=data.notes,
        recorded_at=data.recorded_at or datetime.now(tz=None),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/biometric-logs/{house_id}", response_model=BiometricLogListResponse)
def list_biometric_logs(
    house_id: UUID,
    metric: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    q = db.query(BiometricLog).filter(
        BiometricLog.user_id == current_user.id,
        BiometricLog.house_id == house_id,
    )
    if metric:
        q = q.filter(BiometricLog.metric == metric)
    total = q.count()
    logs = q.order_by(BiometricLog.recorded_at.desc()).offset(offset).limit(limit).all()
    return BiometricLogListResponse(logs=logs, total=total)


@router.delete("/biometric-logs/{house_id}/{log_id}", status_code=204)
def delete_biometric_log(
    house_id: UUID,
    log_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    log = db.query(BiometricLog).filter(
        BiometricLog.id == log_id,
        BiometricLog.house_id == house_id,
        BiometricLog.user_id == current_user.id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log non trovato")
    db.delete(log)
    db.commit()
    return None


# ============================================================================
# HEALTH GOAL ENDPOINTS
# ============================================================================

@router.post("/health-goals/{house_id}", response_model=HealthGoalResponse, status_code=201)
def create_health_goal(
    house_id: UUID,
    data: HealthGoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    goal = HealthGoal(
        user_id=current_user.id,
        house_id=house_id,
        **data.model_dump(exclude_none=True),
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/health-goals/{house_id}", response_model=list[HealthGoalResponse])
def list_health_goals(
    house_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    q = db.query(HealthGoal).filter(
        HealthGoal.user_id == current_user.id,
        HealthGoal.house_id == house_id,
    )
    if status_filter:
        q = q.filter(HealthGoal.status == status_filter)
    return q.order_by(HealthGoal.created_at.desc()).all()


@router.put("/health-goals/{house_id}/{goal_id}", response_model=HealthGoalResponse)
def update_health_goal(
    house_id: UUID,
    goal_id: UUID,
    data: HealthGoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    goal = db.query(HealthGoal).filter(
        HealthGoal.id == goal_id,
        HealthGoal.house_id == house_id,
        HealthGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Obiettivo non trovato")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, key, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/health-goals/{house_id}/{goal_id}", status_code=204)
def delete_health_goal(
    house_id: UUID,
    goal_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)
    goal = db.query(HealthGoal).filter(
        HealthGoal.id == goal_id,
        HealthGoal.house_id == house_id,
        HealthGoal.user_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Obiettivo non trovato")
    db.delete(goal)
    db.commit()
    return None


# ============================================================================
# HEALTH DASHBOARD
# ============================================================================

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}


def _compute_bmi(height_cm: Optional[Decimal], weight_kg: Optional[float]) -> Optional[float]:
    if not height_cm or not weight_kg:
        return None
    h_m = float(height_cm) / 100.0
    if h_m <= 0:
        return None
    return round(weight_kg / (h_m * h_m), 1)


def _compute_tdee(
    profile: BiometricProfile,
    weight_kg: Optional[float],
) -> Optional[float]:
    if not profile.biological_sex or not profile.birth_date or not profile.height_cm or not weight_kg:
        return None
    age = (date.today() - profile.birth_date).days / 365.25
    h = float(profile.height_cm)
    w = weight_kg
    # Harris-Benedict
    if profile.biological_sex == "M":
        bmr = 88.362 + (13.397 * w) + (4.799 * h) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * w) + (3.098 * h) - (4.330 * age)
    multiplier = ACTIVITY_MULTIPLIERS.get(profile.activity_level or "sedentary", 1.2)
    return round(bmr * multiplier, 0)


@router.get("/health-dashboard/{house_id}", response_model=BiometricDashboardResponse)
def get_health_dashboard(
    house_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_house_membership(db, current_user.id, house_id)

    profile = db.query(BiometricProfile).filter(
        BiometricProfile.user_id == current_user.id,
        BiometricProfile.house_id == house_id,
    ).first()

    # Latest log per metric
    subq = (
        db.query(
            BiometricLog.metric,
            sa_func.max(BiometricLog.recorded_at).label("max_ts"),
        )
        .filter(
            BiometricLog.user_id == current_user.id,
            BiometricLog.house_id == house_id,
        )
        .group_by(BiometricLog.metric)
        .subquery()
    )
    latest_rows = (
        db.query(BiometricLog)
        .join(
            subq,
            (BiometricLog.metric == subq.c.metric)
            & (BiometricLog.recorded_at == subq.c.max_ts),
        )
        .filter(
            BiometricLog.user_id == current_user.id,
            BiometricLog.house_id == house_id,
        )
        .all()
    )
    latest_logs = {row.metric: row for row in latest_rows}

    goals = (
        db.query(HealthGoal)
        .filter(
            HealthGoal.user_id == current_user.id,
            HealthGoal.house_id == house_id,
            HealthGoal.status == "active",
        )
        .order_by(HealthGoal.created_at.desc())
        .all()
    )

    weight_log = latest_logs.get("weight_kg")
    current_weight = float(weight_log.value) if weight_log else None
    bmi = _compute_bmi(profile.height_cm if profile else None, current_weight)
    tdee = _compute_tdee(profile, current_weight) if profile else None

    return BiometricDashboardResponse(
        profile=profile,
        latest_logs=latest_logs,
        goals=goals,
        bmi=bmi,
        tdee=tdee,
    )
