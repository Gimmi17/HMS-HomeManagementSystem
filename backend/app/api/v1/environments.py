"""
Environments API Endpoints
CRUD operations for environments (locations within a house).
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User
from app.services.environment_service import EnvironmentService
from app.schemas.environment import (
    EnvironmentCreate,
    EnvironmentUpdate,
    EnvironmentResponse,
    EnvironmentListResponse,
    EnvironmentExpenseStats,
)


router = APIRouter(prefix="/environments")


@router.get("", response_model=EnvironmentListResponse)
def get_environments(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all environments for a house."""
    environments = EnvironmentService.get_environments(db, house_id)

    result = []
    for env in environments:
        item_count = EnvironmentService.get_item_count(db, env.id)
        env_dict = {
            "id": env.id,
            "house_id": env.house_id,
            "name": env.name,
            "icon": env.icon,
            "env_type": env.env_type.value if hasattr(env.env_type, 'value') else env.env_type,
            "description": env.description,
            "is_default": env.is_default,
            "position": env.position,
            "item_count": item_count,
            "created_at": env.created_at,
            "updated_at": env.updated_at,
        }
        result.append(EnvironmentResponse(**env_dict))

    return EnvironmentListResponse(environments=result, total=len(result))


@router.post("", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
def create_environment(
    house_id: UUID = Query(..., description="House ID"),
    data: EnvironmentCreate = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new environment."""
    env = EnvironmentService.create_environment(db, house_id, data)
    db.commit()
    db.refresh(env)

    item_count = EnvironmentService.get_item_count(db, env.id)
    env_dict = {
        "id": env.id,
        "house_id": env.house_id,
        "name": env.name,
        "icon": env.icon,
        "env_type": env.env_type.value if hasattr(env.env_type, 'value') else env.env_type,
        "description": env.description,
        "is_default": env.is_default,
        "position": env.position,
        "item_count": item_count,
        "created_at": env.created_at,
        "updated_at": env.updated_at,
    }
    return EnvironmentResponse(**env_dict)


@router.put("/{env_id}", response_model=EnvironmentResponse)
def update_environment(
    env_id: UUID,
    data: EnvironmentUpdate,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an environment."""
    env = EnvironmentService.update_environment(db, env_id, house_id, data)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambiente non trovato"
        )
    db.commit()
    db.refresh(env)

    item_count = EnvironmentService.get_item_count(db, env.id)
    env_dict = {
        "id": env.id,
        "house_id": env.house_id,
        "name": env.name,
        "icon": env.icon,
        "env_type": env.env_type.value if hasattr(env.env_type, 'value') else env.env_type,
        "description": env.description,
        "is_default": env.is_default,
        "position": env.position,
        "item_count": item_count,
        "created_at": env.created_at,
        "updated_at": env.updated_at,
    }
    return EnvironmentResponse(**env_dict)


@router.delete("/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    env_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an environment (only if not default and no active items)."""
    result = EnvironmentService.delete_environment(db, env_id, house_id)

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )

    db.commit()


@router.get("/{env_id}/stats", response_model=EnvironmentExpenseStats)
def get_environment_stats(
    env_id: UUID,
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get expense stats for an environment."""
    env = EnvironmentService.get_environment_by_id(db, env_id, house_id)
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ambiente non trovato"
        )

    stats = EnvironmentService.get_expense_stats(db, env_id)
    return EnvironmentExpenseStats(**stats)


@router.post("/seed")
def seed_environments(
    house_id: UUID = Query(..., description="House ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed default environments and assign orphaned items."""
    count = EnvironmentService.seed_defaults(db, house_id)
    orphaned = EnvironmentService.assign_orphaned_items(db, house_id)
    db.commit()
    return {
        "message": f"{count} ambienti creati, {orphaned} articoli assegnati",
        "environments_created": count,
        "items_assigned": orphaned,
    }
