from typing import Optional
from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict


# ============================================================================
# BIOMETRIC PROFILE
# ============================================================================

ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "active", "very_active"}
GOALS = {"lose_fat", "maintain", "gain_muscle", "performance"}
DIET_TYPES = {"iperproteica", "ipocalorica", "mediterranea", "chetogenica"}
BIOLOGICAL_SEXES = {"M", "F"}
METRICS = {
    "weight_kg", "body_fat_pct", "waist_cm", "resting_hr", "hrv_ms",
    "bp_systolic", "bp_diastolic", "vo2max", "sleep_hours", "sleep_quality",
    "energy_level", "steps_day", "muscle_mass_kg",
}
GOAL_STATUSES = {"active", "achieved", "abandoned"}


class BiometricProfileCreate(BaseModel):
    birth_date: Optional[date] = None
    biological_sex: Optional[str] = None
    height_cm: Optional[float] = Field(None, gt=0, le=300)
    activity_level: Optional[str] = None
    goal: Optional[str] = None
    diet_type: Optional[str] = None
    target_weight_kg: Optional[float] = Field(None, gt=0, le=500)
    target_kcal: Optional[float] = Field(None, gt=0, le=20000)
    target_protein_g: Optional[float] = Field(None, ge=0, le=2000)
    target_carbs_g: Optional[float] = Field(None, ge=0, le=2000)
    target_fat_g: Optional[float] = Field(None, ge=0, le=2000)
    notes: Optional[str] = None

    @field_validator("activity_level")
    @classmethod
    def validate_activity(cls, v):
        if v and v not in ACTIVITY_LEVELS:
            raise ValueError(f"Must be one of: {', '.join(ACTIVITY_LEVELS)}")
        return v

    @field_validator("goal")
    @classmethod
    def validate_goal(cls, v):
        if v and v not in GOALS:
            raise ValueError(f"Must be one of: {', '.join(GOALS)}")
        return v

    @field_validator("diet_type")
    @classmethod
    def validate_diet(cls, v):
        if v and v not in DIET_TYPES:
            raise ValueError(f"Must be one of: {', '.join(DIET_TYPES)}")
        return v

    @field_validator("biological_sex")
    @classmethod
    def validate_sex(cls, v):
        if v and v not in BIOLOGICAL_SEXES:
            raise ValueError(f"Must be one of: {', '.join(BIOLOGICAL_SEXES)}")
        return v


class BiometricProfileUpdate(BiometricProfileCreate):
    pass


class BiometricProfileResponse(BiometricProfileCreate):
    id: UUID
    user_id: UUID
    house_id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# BIOMETRIC LOG
# ============================================================================

class BiometricLogCreate(BaseModel):
    metric: str = Field(..., max_length=50)
    value: float
    unit: Optional[str] = Field(None, max_length=20)
    source: str = Field("manual", max_length=50)
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None

    @field_validator("metric")
    @classmethod
    def validate_metric(cls, v):
        if v not in METRICS:
            raise ValueError(f"Must be one of: {', '.join(sorted(METRICS))}")
        return v


class BiometricLogUpdate(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=20)
    source: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None
    recorded_at: Optional[datetime] = None


class BiometricLogResponse(BaseModel):
    id: UUID
    user_id: UUID
    house_id: UUID
    metric: str
    value: float
    unit: Optional[str] = None
    source: str
    notes: Optional[str] = None
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BiometricLogListResponse(BaseModel):
    logs: list[BiometricLogResponse]
    total: int
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# HEALTH GOAL
# ============================================================================

class HealthGoalCreate(BaseModel):
    metric: str = Field(..., max_length=50)
    target_value: float
    started_value: Optional[float] = None
    deadline: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("metric")
    @classmethod
    def validate_metric(cls, v):
        if v not in METRICS:
            raise ValueError(f"Must be one of: {', '.join(sorted(METRICS))}")
        return v


class HealthGoalUpdate(BaseModel):
    target_value: Optional[float] = None
    started_value: Optional[float] = None
    deadline: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        if v and v not in GOAL_STATUSES:
            raise ValueError(f"Must be one of: {', '.join(GOAL_STATUSES)}")
        return v


class HealthGoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    house_id: UUID
    metric: str
    target_value: float
    started_value: Optional[float] = None
    deadline: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# DASHBOARD
# ============================================================================

class BiometricDashboardResponse(BaseModel):
    profile: Optional[BiometricProfileResponse] = None
    latest_logs: dict[str, BiometricLogResponse] = {}
    goals: list[HealthGoalResponse] = []
    bmi: Optional[float] = None
    tdee: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)
