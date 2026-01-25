"""
Health Pydantic Schemas
Request and response models for Health and Weight API endpoints.

These schemas define the structure of data for:
    - Weight tracking
    - Health records (symptoms, illnesses, events)
"""

from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


# ============================================================================
# WEIGHT SCHEMAS
# ============================================================================

class WeightBase(BaseModel):
    """
    Base Weight schema with common fields.
    Used as parent class for Weight create/update schemas.
    """
    weight_kg: float = Field(
        ...,
        gt=0,
        le=500,
        description="Weight in kilograms (must be positive, max 500kg)"
    )
    measured_at: datetime = Field(
        ...,
        description="When the weight was measured (timezone-aware)"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional notes about measurement context"
    )


class WeightCreate(WeightBase):
    """
    Schema for creating a new weight measurement.

    Used by:
        POST /api/v1/weights

    Request body example:
    {
        "weight_kg": 75.5,
        "measured_at": "2024-01-13T08:00:00Z",
        "notes": "Morning weight after workout"
    }

    Notes:
        - user_id is inferred from JWT token
        - house_id is inferred from current user context or provided in query param
    """
    pass


class WeightUpdate(BaseModel):
    """
    Schema for updating an existing weight measurement.

    Used by:
        PUT /api/v1/weights/{id}

    All fields are optional (partial update allowed).
    Only provided fields will be updated.
    """
    weight_kg: Optional[float] = Field(
        None,
        gt=0,
        le=500,
        description="Updated weight in kilograms"
    )
    measured_at: Optional[datetime] = Field(
        None,
        description="Updated measurement timestamp"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Updated notes"
    )


class WeightResponse(WeightBase):
    """
    Complete Weight response schema.

    Returned by:
        - POST /api/v1/weights - Create weight
        - GET /api/v1/weights - List weights
        - GET /api/v1/weights/{id} - Get single weight
        - PUT /api/v1/weights/{id} - Update weight

    Includes all weight information plus metadata.
    """
    id: UUID = Field(..., description="Unique weight record identifier")
    user_id: UUID = Field(..., description="User who recorded this weight")
    house_id: UUID = Field(..., description="House this weight belongs to")
    created_at: datetime = Field(..., description="When record was created")
    updated_at: datetime = Field(..., description="When record was last updated")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


class WeightListResponse(BaseModel):
    """
    List of weight measurements with pagination metadata.

    Returned by:
        - GET /api/v1/weights?user_id=xxx&house_id=xxx&from=xxx&to=xxx

    Useful for displaying weight trends, charts, and history.
    """
    weights: list[WeightResponse] = Field(..., description="List of weight measurements")
    total: int = Field(..., description="Total number of weights matching query")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(0, description="Number of results skipped")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# HEALTH RECORD SCHEMAS
# ============================================================================

class HealthRecordBase(BaseModel):
    """
    Base HealthRecord schema with common fields.
    Used as parent class for HealthRecord create/update schemas.
    """
    type: Optional[str] = Field(
        None,
        max_length=100,
        description="Health event type (e.g., 'cold', 'headache', 'allergy')"
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Detailed description of health event or symptoms"
    )
    severity: Optional[str] = Field(
        None,
        description="Severity level: 'mild', 'moderate', or 'severe'"
    )
    recorded_at: datetime = Field(
        ...,
        description="When the health event occurred (timezone-aware)"
    )

    @field_validator('severity')
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        """
        Validate severity is one of allowed values.

        Allowed values: 'mild', 'moderate', 'severe' (case-insensitive)
        Returns None if not provided.
        """
        if v is None:
            return None

        allowed_severities = {'mild', 'moderate', 'severe'}
        v_lower = v.lower().strip()

        if v_lower not in allowed_severities:
            raise ValueError(
                f"Severity must be one of: {', '.join(allowed_severities)}. Got: {v}"
            )

        return v_lower


class HealthRecordCreate(HealthRecordBase):
    """
    Schema for creating a new health record.

    Used by:
        POST /api/v1/health

    Request body example:
    {
        "type": "headache",
        "description": "Severe headache with light sensitivity",
        "severity": "moderate",
        "recorded_at": "2024-01-13T14:30:00Z"
    }

    Notes:
        - user_id is inferred from JWT token
        - house_id is inferred from current user context or provided in query param
    """
    pass


class HealthRecordUpdate(BaseModel):
    """
    Schema for updating an existing health record.

    Used by:
        PUT /api/v1/health/{id}

    All fields are optional (partial update allowed).
    Only provided fields will be updated.
    """
    type: Optional[str] = Field(
        None,
        max_length=100,
        description="Updated health event type"
    )
    description: Optional[str] = Field(
        None,
        min_length=1,
        max_length=5000,
        description="Updated description"
    )
    severity: Optional[str] = Field(
        None,
        description="Updated severity level"
    )
    recorded_at: Optional[datetime] = Field(
        None,
        description="Updated event timestamp"
    )

    @field_validator('severity')
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        """Validate severity is one of allowed values."""
        if v is None:
            return None

        allowed_severities = {'mild', 'moderate', 'severe'}
        v_lower = v.lower().strip()

        if v_lower not in allowed_severities:
            raise ValueError(
                f"Severity must be one of: {', '.join(allowed_severities)}. Got: {v}"
            )

        return v_lower


class HealthRecordResponse(HealthRecordBase):
    """
    Complete HealthRecord response schema.

    Returned by:
        - POST /api/v1/health - Create health record
        - GET /api/v1/health - List health records
        - GET /api/v1/health/{id} - Get single health record
        - PUT /api/v1/health/{id} - Update health record

    Includes all health record information plus metadata.
    """
    id: UUID = Field(..., description="Unique health record identifier")
    user_id: UUID = Field(..., description="User who recorded this health event")
    house_id: UUID = Field(..., description="House this record belongs to")
    created_at: datetime = Field(..., description="When record was created")
    updated_at: datetime = Field(..., description="When record was last updated")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


class HealthRecordListResponse(BaseModel):
    """
    List of health records with pagination metadata.

    Returned by:
        - GET /api/v1/health?user_id=xxx&house_id=xxx&type=xxx&from=xxx&to=xxx

    Useful for health history, trend analysis, and pattern recognition.
    """
    records: list[HealthRecordResponse] = Field(..., description="List of health records")
    total: int = Field(..., description="Total number of records matching query")
    limit: int = Field(..., description="Number of results per page")
    offset: int = Field(0, description="Number of results skipped")

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# COMBINED HEALTH DASHBOARD SCHEMA (Optional)
# ============================================================================

class HealthDashboardResponse(BaseModel):
    """
    Combined health dashboard data.

    Returned by:
        - GET /api/v1/health/dashboard (optional endpoint)

    Provides a summary of recent health data for dashboard display:
        - Latest weight
        - Recent weight trend
        - Recent health events
        - Health statistics
    """
    latest_weight: Optional[WeightResponse] = Field(
        None,
        description="Most recent weight measurement"
    )
    weight_trend: Optional[str] = Field(
        None,
        description="Weight trend: 'up', 'down', 'stable'"
    )
    weight_change_kg: Optional[float] = Field(
        None,
        description="Weight change over last 30 days (kg)"
    )
    recent_health_events: list[HealthRecordResponse] = Field(
        default_factory=list,
        description="Recent health records (last 30 days)"
    )
    health_event_count: int = Field(
        0,
        description="Total health events in last 30 days"
    )

    # Pydantic v2 configuration
    model_config = ConfigDict(from_attributes=True)


# Example API Responses:
# ----------------------
# POST /api/v1/weights
# Request:
# {
#   "weight_kg": 75.5,
#   "measured_at": "2024-01-13T08:00:00Z",
#   "notes": "Morning weight"
# }
#
# Response:
# {
#   "id": "uuid",
#   "user_id": "uuid",
#   "house_id": "uuid",
#   "weight_kg": 75.5,
#   "measured_at": "2024-01-13T08:00:00Z",
#   "notes": "Morning weight",
#   "created_at": "2024-01-13T08:05:00Z",
#   "updated_at": "2024-01-13T08:05:00Z"
# }
