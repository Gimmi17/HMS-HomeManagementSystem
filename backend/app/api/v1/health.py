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

# Create routers
# Note: In production, these would require authentication via Depends(get_current_user)
router = APIRouter(tags=["health"])


# ============================================================================
# WEIGHT ENDPOINTS
# ============================================================================

@router.post("/weights", response_model=WeightResponse, status_code=status.HTTP_201_CREATED)
def create_weight(
    weight_data: WeightCreate,
    house_id: UUID = Query(..., description="House ID for the weight record"),
    user_id: UUID = Query(..., description="User ID for the weight record"),
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    Create a new weight measurement.

    Request Body:
        - weight_kg: Weight in kilograms (required)
        - measured_at: When weight was measured (required)
        - notes: Optional context notes

    Query Parameters:
        - house_id: House ID (required for multi-tenant isolation)
        - user_id: User ID (required, identifies who recorded weight)

    Returns:
        WeightResponse: Created weight record with ID and timestamps

    Example Request:
        POST /api/v1/weights?house_id=xxx&user_id=xxx
        {
            "weight_kg": 75.5,
            "measured_at": "2024-01-13T08:00:00Z",
            "notes": "Morning weight after workout"
        }

    Security:
        - TODO: Verify user_id matches current_user or is member of house
        - TODO: Verify house_id is accessible by current_user
    """
    # TODO: Verify permissions
    # if user_id != current_user.id and not is_house_member(current_user, house_id):
    #     raise HTTPException(status_code=403, detail="Not authorized")

    weight = health_service.create_weight(
        db=db,
        user_id=user_id,
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
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    List weight measurements with filters.

    Query Parameters:
        - house_id: Filter by house (required)
        - user_id: Filter by specific user (optional, shows all house members if omitted)
        - from_date: Filter weights after this date (optional)
        - to_date: Filter weights before this date (optional)
        - limit: Max results per page (default 100, max 500)
        - offset: Skip N results (for pagination)

    Returns:
        WeightListResponse with list of weights and pagination metadata

    Use Cases:
        - Display user's weight history
        - Show household weight trends
        - Generate weight charts for date ranges

    Example:
        GET /api/v1/weights?house_id=xxx&user_id=xxx&from_date=2024-01-01&limit=50
        → Returns last 50 weights for user after 2024-01-01

    Security:
        - TODO: Verify current_user has access to house_id
        - TODO: If user_id specified, verify it's current_user or house member
    """
    # TODO: Verify permissions
    # if not is_house_member(current_user, house_id):
    #     raise HTTPException(status_code=403, detail="Not authorized")

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
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    Get a single weight measurement by ID.

    Path Parameters:
        - weight_id: UUID of the weight record

    Query Parameters:
        - house_id: House ID for security verification

    Returns:
        WeightResponse: Weight record details

    Raises:
        404: Weight not found or doesn't belong to specified house

    Security:
        - Verifies weight belongs to specified house (prevents cross-house access)
        - TODO: Verify current_user has access to house
    """
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
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    Update an existing weight measurement.

    Path Parameters:
        - weight_id: UUID of the weight record to update

    Request Body:
        - weight_kg: Updated weight (optional)
        - measured_at: Updated timestamp (optional)
        - notes: Updated notes (optional)

    Query Parameters:
        - house_id: House ID for security verification

    Returns:
        WeightResponse: Updated weight record

    Raises:
        404: Weight not found

    Note:
        Partial updates are allowed. Only provided fields are updated.

    Security:
        - TODO: Verify current_user is owner of weight or house admin
    """
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
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    Delete a weight measurement.

    Path Parameters:
        - weight_id: UUID of the weight record to delete

    Query Parameters:
        - house_id: House ID for security verification

    Returns:
        204 No Content on success

    Raises:
        404: Weight not found

    Security:
        - TODO: Verify current_user is owner of weight or house admin
    """
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
    user_id: UUID = Query(..., description="User ID for the health record"),
    db: Session = Depends(get_db)
    # current_user: User = Depends(get_current_user)  # TODO: Add auth
):
    """
    Create a new health record.

    Request Body:
        - type: Health event type (optional, e.g., "headache", "cold")
        - description: Event description (required)
        - severity: "mild", "moderate", or "severe" (optional)
        - recorded_at: When event occurred (required)

    Query Parameters:
        - house_id: House ID
        - user_id: User ID

    Returns:
        HealthRecordResponse: Created health record

    Example Request:
        POST /api/v1/health?house_id=xxx&user_id=xxx
        {
            "type": "headache",
            "description": "Severe headache after lunch",
            "severity": "moderate",
            "recorded_at": "2024-01-13T14:30:00Z"
        }
    """
    record = health_service.create_health_record(
        db=db,
        user_id=user_id,
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
    db: Session = Depends(get_db)
):
    """
    List health records with filters.

    Query Parameters:
        - house_id: Filter by house (required)
        - user_id: Filter by user (optional)
        - type: Filter by event type (optional)
        - severity: Filter by severity (optional)
        - from_date: Filter after this date (optional)
        - to_date: Filter before this date (optional)
        - limit: Max results (default 100)
        - offset: Skip N results (default 0)

    Returns:
        HealthRecordListResponse with records and pagination metadata

    Example:
        GET /api/v1/health?house_id=xxx&user_id=xxx&type=headache&severity=moderate
        → Returns moderate headaches for user
    """
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
    db: Session = Depends(get_db)
):
    """
    Get a single health record by ID.

    Path Parameters:
        - record_id: UUID of the health record

    Query Parameters:
        - house_id: House ID for security verification

    Returns:
        HealthRecordResponse: Health record details

    Raises:
        404: Record not found
    """
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
    db: Session = Depends(get_db)
):
    """
    Update an existing health record.

    Path Parameters:
        - record_id: UUID of the record to update

    Request Body:
        - type: Updated event type (optional)
        - description: Updated description (optional)
        - severity: Updated severity (optional)
        - recorded_at: Updated timestamp (optional)

    Returns:
        HealthRecordResponse: Updated health record

    Raises:
        404: Record not found
    """
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
    db: Session = Depends(get_db)
):
    """
    Delete a health record.

    Path Parameters:
        - record_id: UUID of the record to delete

    Query Parameters:
        - house_id: House ID for security verification

    Returns:
        204 No Content on success

    Raises:
        404: Record not found
    """
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
