"""
Areas API Endpoints
CRUD operations for areas (locations within a house).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.services.area_service import AreaService
from app.schemas.area import (
    AreaCreate,
    AreaUpdate,
    AreaResponse,
    AreaListResponse,
    AreaExpenseStats,
)


router = APIRouter(prefix="/areas")


@router.get("", response_model=AreaListResponse)
def get_areas(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all areas for a house."""
    areas = AreaService.get_areas(db, house_id)

    result = []
    for area in areas:
        item_count = AreaService.get_item_count(db, area.id)
        area_dict = {
            "id": area.id,
            "house_id": area.house_id,
            "name": area.name,
            "icon": area.icon,
            "area_type": area.area_type.value if hasattr(area.area_type, 'value') else area.area_type,
            "description": area.description,
            "is_default": area.is_default,
            "position": area.position,
            "expiry_extension_enabled": area.expiry_extension_enabled,
            "disable_expiry_tracking": area.disable_expiry_tracking,
            "warranty_tracking_enabled": area.warranty_tracking_enabled,
            "default_warranty_months": area.default_warranty_months,
            "trial_period_enabled": area.trial_period_enabled,
            "default_trial_days": area.default_trial_days,
            "item_count": item_count,
            "created_at": area.created_at,
            "updated_at": area.updated_at,
        }
        result.append(AreaResponse(**area_dict))

    return AreaListResponse(areas=result, total=len(result))


@router.post("", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(
    house_id: UUID = Query(..., description="House ID"),
    data: AreaCreate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new area."""
    area = AreaService.create_area(db, house_id, data)
    db.commit()
    db.refresh(area)

    item_count = AreaService.get_item_count(db, area.id)
    area_dict = {
        "id": area.id,
        "house_id": area.house_id,
        "name": area.name,
        "icon": area.icon,
        "area_type": area.area_type.value if hasattr(area.area_type, 'value') else area.area_type,
        "description": area.description,
        "is_default": area.is_default,
        "position": area.position,
        "expiry_extension_enabled": area.expiry_extension_enabled,
        "disable_expiry_tracking": area.disable_expiry_tracking,
        "warranty_tracking_enabled": area.warranty_tracking_enabled,
        "default_warranty_months": area.default_warranty_months,
        "trial_period_enabled": area.trial_period_enabled,
        "default_trial_days": area.default_trial_days,
        "item_count": item_count,
        "created_at": area.created_at,
        "updated_at": area.updated_at,
    }
    return AreaResponse(**area_dict)


@router.put("/{area_id}", response_model=AreaResponse)
def update_area(
    area_id: UUID,
    data: AreaUpdate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an area."""
    area = AreaService.update_area(db, area_id, house_id, data)
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area non trovata"
        )
    db.commit()
    db.refresh(area)

    item_count = AreaService.get_item_count(db, area.id)
    area_dict = {
        "id": area.id,
        "house_id": area.house_id,
        "name": area.name,
        "icon": area.icon,
        "area_type": area.area_type.value if hasattr(area.area_type, 'value') else area.area_type,
        "description": area.description,
        "is_default": area.is_default,
        "position": area.position,
        "expiry_extension_enabled": area.expiry_extension_enabled,
        "disable_expiry_tracking": area.disable_expiry_tracking,
        "warranty_tracking_enabled": area.warranty_tracking_enabled,
        "default_warranty_months": area.default_warranty_months,
        "trial_period_enabled": area.trial_period_enabled,
        "default_trial_days": area.default_trial_days,
        "item_count": item_count,
        "created_at": area.created_at,
        "updated_at": area.updated_at,
    }
    return AreaResponse(**area_dict)


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(
    area_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an area (only if not default and no active items)."""
    result = AreaService.delete_area(db, area_id, house_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )

    db.commit()


@router.get("/{area_id}/stats", response_model=AreaExpenseStats)
def get_area_stats(
    area_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get expense stats for an area."""
    area = AreaService.get_area_by_id(db, area_id, house_id)
    if not area:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Area non trovata"
        )

    stats = AreaService.get_expense_stats(db, area_id)
    return AreaExpenseStats(**stats)


@router.post("/seed")
def seed_areas(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed default areas and assign orphaned items."""
    count = AreaService.seed_defaults(db, house_id)
    orphaned = AreaService.assign_orphaned_items(db, house_id)
    db.commit()
    return {
        "message": f"{count} aree create, {orphaned} articoli assegnati",
        "areas_created": count,
        "items_assigned": orphaned,
    }
