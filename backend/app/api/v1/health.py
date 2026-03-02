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
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.models.user_house import UserHouse
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

# Uncomment to enable analytics endpoints:
#
# @router.get("/weights/trend", response_model=dict)
# def get_weight_trend_endpoint(
#     user_id: UUID = Query(...),
#     house_id: UUID = Query(...),
#     days: int = Query(30, ge=1, le=365),
#     db: Session = Depends(get_db)
# ):
#     """Get weight trend analysis for user."""
#     return health_service.get_weight_trend(db, user_id, house_id, days)
#
#
# @router.get("/health/summary", response_model=dict)
# def get_health_summary_endpoint(
#     user_id: UUID = Query(...),
#     house_id: UUID = Query(...),
#     days: int = Query(30, ge=1, le=365),
#     db: Session = Depends(get_db)
# ):
#     """Get health event summary for user."""
#     return health_service.get_health_event_summary(db, user_id, house_id, days)
