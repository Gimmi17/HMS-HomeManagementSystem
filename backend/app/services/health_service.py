"""
Health Service
Business logic for health-related operations (weights and health records).

This service provides reusable functions for:
    - Creating, reading, updating, deleting weight measurements
    - Creating, reading, updating, deleting health records
    - Calculating health statistics and trends
    - Filtering and querying health data

Separating business logic from API routes improves:
    - Code reusability
    - Testability
    - Maintainability
    - Clear separation of concerns
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from app.models.weight import Weight
from app.models.health_record import HealthRecord
from app.schemas.health import (
    WeightCreate,
    WeightUpdate,
    HealthRecordCreate,
    HealthRecordUpdate,
)


# ============================================================================
# WEIGHT SERVICE FUNCTIONS
# ============================================================================

def create_weight(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    weight_data: WeightCreate
) -> Weight:
    """
    Create a new weight measurement.

    Args:
        db: Database session
        user_id: ID of user recording weight
        house_id: ID of house the user belongs to
        weight_data: Weight measurement data from request

    Returns:
        Weight: Created weight record

    Example:
        weight = create_weight(
            db=db,
            user_id=current_user.id,
            house_id=current_user.house_id,
            weight_data=WeightCreate(
                weight_kg=75.5,
                measured_at=datetime.now(),
                notes="Morning weight"
            )
        )
    """
    # Create Weight instance from Pydantic model
    db_weight = Weight(
        user_id=user_id,
        house_id=house_id,
        weight_kg=weight_data.weight_kg,
        measured_at=weight_data.measured_at,
        notes=weight_data.notes
    )

    # Add to database and commit
    db.add(db_weight)
    db.commit()
    db.refresh(db_weight)  # Refresh to get created_at, updated_at values

    return db_weight


def get_weights(
    db: Session,
    house_id: UUID,
    user_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> tuple[list[Weight], int]:
    """
    Get list of weight measurements with filters.

    Args:
        db: Database session
        house_id: House ID (required for multi-tenant isolation)
        user_id: Optional user ID to filter by specific user
        from_date: Optional start date for date range filter
        to_date: Optional end date for date range filter
        limit: Maximum number of results (default 100)
        offset: Number of results to skip (default 0)

    Returns:
        tuple: (list of Weight objects, total count)

    Example:
        weights, total = get_weights(
            db=db,
            house_id=house.id,
            user_id=user.id,
            from_date=datetime(2024, 1, 1),
            to_date=datetime.now(),
            limit=50,
            offset=0
        )
    """
    # Build query with filters
    query = db.query(Weight).filter(Weight.house_id == house_id)

    # Filter by user if specified
    if user_id:
        query = query.filter(Weight.user_id == user_id)

    # Filter by date range if specified
    if from_date:
        query = query.filter(Weight.measured_at >= from_date)
    if to_date:
        query = query.filter(Weight.measured_at <= to_date)

    # Get total count before pagination
    total = query.count()

    # Apply ordering (most recent first) and pagination
    weights = query.order_by(desc(Weight.measured_at)).limit(limit).offset(offset).all()

    return weights, total


def get_weight_by_id(db: Session, weight_id: UUID, house_id: UUID) -> Optional[Weight]:
    """
    Get a single weight measurement by ID.

    Args:
        db: Database session
        weight_id: Weight record ID
        house_id: House ID for multi-tenant security check

    Returns:
        Weight or None if not found or belongs to different house

    Security:
        Always verify house_id to prevent accessing other houses' data.
    """
    return db.query(Weight).filter(
        and_(
            Weight.id == weight_id,
            Weight.house_id == house_id
        )
    ).first()


def update_weight(
    db: Session,
    weight_id: UUID,
    house_id: UUID,
    weight_data: WeightUpdate
) -> Optional[Weight]:
    """
    Update an existing weight measurement.

    Args:
        db: Database session
        weight_id: Weight record ID to update
        house_id: House ID for security verification
        weight_data: Updated weight data (partial update allowed)

    Returns:
        Updated Weight or None if not found

    Note:
        Only provided fields are updated (partial update).
        updated_at is automatically updated by SQLAlchemy.
    """
    # Get existing weight
    db_weight = get_weight_by_id(db, weight_id, house_id)
    if not db_weight:
        return None

    # Update only provided fields
    update_data = weight_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_weight, field, value)

    db.commit()
    db.refresh(db_weight)

    return db_weight


def delete_weight(db: Session, weight_id: UUID, house_id: UUID) -> bool:
    """
    Delete a weight measurement.

    Args:
        db: Database session
        weight_id: Weight record ID to delete
        house_id: House ID for security verification

    Returns:
        bool: True if deleted, False if not found

    Security:
        Verifies house_id before deletion to prevent unauthorized deletions.
    """
    db_weight = get_weight_by_id(db, weight_id, house_id)
    if not db_weight:
        return False

    db.delete(db_weight)
    db.commit()

    return True


# ============================================================================
# HEALTH RECORD SERVICE FUNCTIONS
# ============================================================================

def create_health_record(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    record_data: HealthRecordCreate
) -> HealthRecord:
    """
    Create a new health record.

    Args:
        db: Database session
        user_id: ID of user recording health event
        house_id: ID of house the user belongs to
        record_data: Health record data from request

    Returns:
        HealthRecord: Created health record

    Example:
        record = create_health_record(
            db=db,
            user_id=current_user.id,
            house_id=current_user.house_id,
            record_data=HealthRecordCreate(
                type="headache",
                description="Severe headache after lunch",
                severity="moderate",
                recorded_at=datetime.now()
            )
        )
    """
    # Create HealthRecord instance
    db_record = HealthRecord(
        user_id=user_id,
        house_id=house_id,
        type=record_data.type,
        description=record_data.description,
        severity=record_data.severity,
        recorded_at=record_data.recorded_at
    )

    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    return db_record


def get_health_records(
    db: Session,
    house_id: UUID,
    user_id: Optional[UUID] = None,
    type_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    offset: int = 0
) -> tuple[list[HealthRecord], int]:
    """
    Get list of health records with filters.

    Args:
        db: Database session
        house_id: House ID (required for multi-tenant isolation)
        user_id: Optional user ID to filter by specific user
        type_filter: Optional health event type filter (e.g., "headache")
        severity_filter: Optional severity filter ("mild", "moderate", "severe")
        from_date: Optional start date for date range filter
        to_date: Optional end date for date range filter
        limit: Maximum number of results (default 100)
        offset: Number of results to skip (default 0)

    Returns:
        tuple: (list of HealthRecord objects, total count)

    Example:
        records, total = get_health_records(
            db=db,
            house_id=house.id,
            user_id=user.id,
            type_filter="headache",
            severity_filter="moderate",
            limit=50
        )
    """
    # Build query with filters
    query = db.query(HealthRecord).filter(HealthRecord.house_id == house_id)

    # Filter by user if specified
    if user_id:
        query = query.filter(HealthRecord.user_id == user_id)

    # Filter by type if specified
    if type_filter:
        query = query.filter(HealthRecord.type == type_filter)

    # Filter by severity if specified
    if severity_filter:
        query = query.filter(HealthRecord.severity == severity_filter.lower())

    # Filter by date range if specified
    if from_date:
        query = query.filter(HealthRecord.recorded_at >= from_date)
    if to_date:
        query = query.filter(HealthRecord.recorded_at <= to_date)

    # Get total count before pagination
    total = query.count()

    # Apply ordering (most recent first) and pagination
    records = query.order_by(desc(HealthRecord.recorded_at)).limit(limit).offset(offset).all()

    return records, total


def get_health_record_by_id(
    db: Session,
    record_id: UUID,
    house_id: UUID
) -> Optional[HealthRecord]:
    """
    Get a single health record by ID.

    Args:
        db: Database session
        record_id: Health record ID
        house_id: House ID for multi-tenant security check

    Returns:
        HealthRecord or None if not found
    """
    return db.query(HealthRecord).filter(
        and_(
            HealthRecord.id == record_id,
            HealthRecord.house_id == house_id
        )
    ).first()


def update_health_record(
    db: Session,
    record_id: UUID,
    house_id: UUID,
    record_data: HealthRecordUpdate
) -> Optional[HealthRecord]:
    """
    Update an existing health record.

    Args:
        db: Database session
        record_id: Health record ID to update
        house_id: House ID for security verification
        record_data: Updated health record data (partial update allowed)

    Returns:
        Updated HealthRecord or None if not found
    """
    # Get existing record
    db_record = get_health_record_by_id(db, record_id, house_id)
    if not db_record:
        return None

    # Update only provided fields
    update_data = record_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_record, field, value)

    db.commit()
    db.refresh(db_record)

    return db_record


def delete_health_record(db: Session, record_id: UUID, house_id: UUID) -> bool:
    """
    Delete a health record.

    Args:
        db: Database session
        record_id: Health record ID to delete
        house_id: House ID for security verification

    Returns:
        bool: True if deleted, False if not found
    """
    db_record = get_health_record_by_id(db, record_id, house_id)
    if not db_record:
        return False

    db.delete(db_record)
    db.commit()

    return True


# ============================================================================
# ANALYTICS AND STATISTICS FUNCTIONS
# ============================================================================

def get_weight_trend(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    days: int = 30
) -> dict:
    """
    Calculate weight trend over specified period.

    Args:
        db: Database session
        user_id: User ID to analyze
        house_id: House ID for security
        days: Number of days to analyze (default 30)

    Returns:
        dict with trend data:
            - latest_weight: Most recent weight
            - oldest_weight: Oldest weight in period
            - change_kg: Weight change (positive = gained, negative = lost)
            - trend: "up", "down", or "stable"
            - average_weight: Average weight in period

    Example:
        trend = get_weight_trend(db, user_id, house_id, days=30)
        # {
        #     "latest_weight": 75.5,
        #     "oldest_weight": 77.0,
        #     "change_kg": -1.5,
        #     "trend": "down",
        #     "average_weight": 76.2
        # }
    """
    # Get date range
    to_date = datetime.now()
    from_date = to_date - timedelta(days=days)

    # Get weights in date range
    weights, _ = get_weights(
        db=db,
        house_id=house_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        limit=1000  # Get all weights in period
    )

    if not weights:
        return {
            "latest_weight": None,
            "oldest_weight": None,
            "change_kg": 0,
            "trend": "stable",
            "average_weight": None
        }

    # Calculate statistics
    latest_weight = float(weights[0].weight_kg)  # Already ordered by date desc
    oldest_weight = float(weights[-1].weight_kg)
    change_kg = latest_weight - oldest_weight
    average_weight = sum(float(w.weight_kg) for w in weights) / len(weights)

    # Determine trend (threshold: 0.5kg)
    if change_kg > 0.5:
        trend = "up"
    elif change_kg < -0.5:
        trend = "down"
    else:
        trend = "stable"

    return {
        "latest_weight": latest_weight,
        "oldest_weight": oldest_weight,
        "change_kg": round(change_kg, 2),
        "trend": trend,
        "average_weight": round(average_weight, 2)
    }


def get_health_event_summary(
    db: Session,
    user_id: UUID,
    house_id: UUID,
    days: int = 30
) -> dict:
    """
    Get summary of health events over specified period.

    Args:
        db: Database session
        user_id: User ID to analyze
        house_id: House ID for security
        days: Number of days to analyze (default 30)

    Returns:
        dict with event summary:
            - total_events: Total number of health events
            - by_type: Count grouped by event type
            - by_severity: Count grouped by severity
            - most_common_type: Most frequent event type

    Example:
        summary = get_health_event_summary(db, user_id, house_id, days=30)
        # {
        #     "total_events": 5,
        #     "by_type": {"headache": 3, "cold": 2},
        #     "by_severity": {"mild": 2, "moderate": 3},
        #     "most_common_type": "headache"
        # }
    """
    # Get date range
    to_date = datetime.now()
    from_date = to_date - timedelta(days=days)

    # Get health records in date range
    records, total = get_health_records(
        db=db,
        house_id=house_id,
        user_id=user_id,
        from_date=from_date,
        to_date=to_date,
        limit=1000
    )

    if not records:
        return {
            "total_events": 0,
            "by_type": {},
            "by_severity": {},
            "most_common_type": None
        }

    # Group by type
    by_type = {}
    for record in records:
        type_name = record.type or "other"
        by_type[type_name] = by_type.get(type_name, 0) + 1

    # Group by severity
    by_severity = {}
    for record in records:
        severity = record.severity or "unknown"
        by_severity[severity] = by_severity.get(severity, 0) + 1

    # Find most common type
    most_common_type = max(by_type, key=by_type.get) if by_type else None

    return {
        "total_events": total,
        "by_type": by_type,
        "by_severity": by_severity,
        "most_common_type": most_common_type
    }
