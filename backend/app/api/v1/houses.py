"""
Houses API Endpoints
RESTful API for house management and invitation system.

Endpoints:
- POST   /houses              - Create new house
- GET    /houses              - List user's houses
- GET    /houses/{id}         - Get house details with members
- PUT    /houses/{id}         - Update house (owner only)
- DELETE /houses/{id}         - Delete house (owner only)
- POST   /houses/{id}/invites - Generate invitation code
- POST   /houses/join         - Join house with code
- DELETE /houses/{id}/members/{user_id} - Remove member (owner only)

All endpoints require authentication except documentation notes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.house import (
    HouseCreate,
    HouseUpdate,
    HouseResponse,
    HouseDetailResponse,
    HouseMemberResponse,
    HouseInviteCreate,
    HouseInviteResponse,
    HouseJoinRequest,
    HouseMemberRemoveResponse
)
from app.services.house_service import HouseService


# Create router with common prefix and tags
router = APIRouter(
    prefix="/houses",
    tags=["Houses"]
)


@router.post(
    "",
    response_model=HouseDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new house",
    description="""
    Create a new house with the authenticated user as owner.

    The creator automatically becomes the house owner and can:
    - Modify house settings
    - Generate invitation codes
    - Remove members
    - Delete the house

    Returns the created house with the owner in the members list.
    """
)
def create_house(
    house_data: HouseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new house.

    Args:
        house_data: House creation data from request body
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        Created house with member details

    Example request:
        POST /api/v1/houses
        {
            "name": "Casa Rossi",
            "description": "Famiglia Rossi - 4 persone",
            "location": "Milano, Italia",
            "settings": {
                "timezone": "Europe/Rome"
            }
        }

    Example response:
        {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "owner_id": "987fcdeb-51a2-43f7-9876-543210987654",
            "name": "Casa Rossi",
            "description": "Famiglia Rossi - 4 persone",
            "location": "Milano, Italia",
            "settings": {"timezone": "Europe/Rome"},
            "created_at": "2025-01-13T12:00:00Z",
            "updated_at": "2025-01-13T12:00:00Z",
            "members": [
                {
                    "user_id": "987fcdeb-51a2-43f7-9876-543210987654",
                    "email": "owner@example.com",
                    "full_name": "Mario Rossi",
                    "role": "OWNER",
                    "joined_at": "2025-01-13T12:00:00Z"
                }
            ]
        }
    """
    try:
        # Create house with current user as owner
        house = HouseService.create_house(
            db=db,
            house_data=house_data,
            owner_id=current_user.id
        )
        db.commit()

        # Get house with members for response
        house_with_members = HouseService.get_house_with_members(db, house.id)

        # Build response
        members = [
            HouseMemberResponse(
                user_id=m["user"].id,
                email=m["user"].email,
                full_name=m["user"].full_name,
                role=m["membership"].role,
                joined_at=m["membership"].joined_at
            )
            for m in house_with_members["members"]
        ]

        return HouseDetailResponse(
            id=house.id,
            owner_id=house.owner_id,
            name=house.name,
            description=house.description,
            location=house.location,
            settings=house.settings,
            created_at=house.created_at,
            updated_at=house.updated_at,
            members=members
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create house: {str(e)}"
        )


@router.get(
    "",
    response_model=List[HouseResponse],
    summary="List user's houses",
    description="""
    Get list of all houses the authenticated user belongs to.

    Returns basic house information without member lists.
    Use GET /houses/{id} to get detailed information with members.
    """
)
def list_houses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all houses user is a member of.

    Args:
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        List of houses with basic information

    Example response:
        [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "owner_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "name": "Casa Rossi",
                "description": "Famiglia Rossi",
                "location": "Milano, Italia",
                "settings": {"timezone": "Europe/Rome"},
                "created_at": "2025-01-13T12:00:00Z",
                "updated_at": "2025-01-13T12:00:00Z"
            },
            {
                "id": "456e7890-f12b-34c5-d678-901234567890",
                "owner_id": "123e4567-e89b-12d3-a456-426614174000",
                "name": "Casa Bianchi",
                "description": null,
                "location": null,
                "settings": {},
                "created_at": "2025-01-10T10:00:00Z",
                "updated_at": "2025-01-10T10:00:00Z"
            }
        ]
    """
    houses = HouseService.get_user_houses(db, current_user.id)

    return [
        HouseResponse(
            id=house.id,
            owner_id=house.owner_id,
            name=house.name,
            description=house.description,
            location=house.location,
            settings=house.settings,
            created_at=house.created_at,
            updated_at=house.updated_at
        )
        for house in houses
    ]


@router.get(
    "/{house_id}",
    response_model=HouseDetailResponse,
    summary="Get house details",
    description="""
    Get detailed information about a specific house.

    Includes:
    - House basic information
    - Full list of members with roles
    - Member join timestamps

    User must be a member of the house to view details.
    """
)
def get_house(
    house_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get house details with members.

    Args:
        house_id: House ID from URL path
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        House details with member list

    Raises:
        404: House not found
        403: User is not a member of this house
    """
    # Check if user is member of this house
    membership = HouseService.check_user_membership(db, current_user.id, house_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this house"
        )

    # Get house with members
    house_data = HouseService.get_house_with_members(db, house_id)
    if not house_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="House not found"
        )

    house = house_data["house"]

    # Build members list
    members = [
        HouseMemberResponse(
            user_id=m["user"].id,
            email=m["user"].email,
            full_name=m["user"].full_name,
            role=m["membership"].role,
            joined_at=m["membership"].joined_at
        )
        for m in house_data["members"]
    ]

    return HouseDetailResponse(
        id=house.id,
        owner_id=house.owner_id,
        name=house.name,
        description=house.description,
        location=house.location,
        settings=house.settings,
        created_at=house.created_at,
        updated_at=house.updated_at,
        members=members
    )


@router.put(
    "/{house_id}",
    response_model=HouseResponse,
    summary="Update house",
    description="""
    Update house information.

    Only the house owner can update house settings.
    All fields are optional - only provided fields will be updated.
    """
)
def update_house(
    house_id: UUID,
    house_data: HouseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update house information.

    Args:
        house_id: House ID from URL path
        house_data: Update data from request body
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        Updated house information

    Raises:
        404: House not found
        403: User is not the house owner

    Example request:
        PUT /api/v1/houses/123e4567-e89b-12d3-a456-426614174000
        {
            "name": "Casa Verdi",
            "settings": {
                "timezone": "Europe/Paris"
            }
        }
    """
    try:
        house = HouseService.update_house(
            db=db,
            house_id=house_id,
            house_data=house_data,
            user_id=current_user.id
        )

        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="House not found"
            )

        db.commit()

        return HouseResponse(
            id=house.id,
            owner_id=house.owner_id,
            name=house.name,
            description=house.description,
            location=house.location,
            settings=house.settings,
            created_at=house.created_at,
            updated_at=house.updated_at
        )

    except PermissionError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update house: {str(e)}"
        )


@router.delete(
    "/{house_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete house",
    description="""
    Delete a house permanently.

    Only the house owner can delete the house.
    This will also delete:
    - All memberships
    - All invitations
    - All recipes in this house
    - All meals logged in this house

    This action cannot be undone.
    """
)
def delete_house(
    house_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a house.

    Args:
        house_id: House ID from URL path
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        204 No Content on success

    Raises:
        404: House not found
        403: User is not the house owner
    """
    try:
        deleted = HouseService.delete_house(
            db=db,
            house_id=house_id,
            user_id=current_user.id
        )

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="House not found"
            )

        db.commit()

    except PermissionError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete house: {str(e)}"
        )


@router.post(
    "/{house_id}/invites",
    response_model=HouseInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate invitation code",
    description="""
    Generate a new invitation code for the house.

    The code:
    - Is 6 characters long (uppercase letters and numbers)
    - Expires after 7 days
    - Can only be used once
    - Example: "ABC123"

    Any member of the house can generate invitations.
    Share the code externally (WhatsApp, Telegram, email, etc).
    """
)
def create_invite(
    house_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate invitation code for house.

    Args:
        house_id: House ID from URL path
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        Invitation code and expiration info

    Raises:
        404: House not found
        403: User is not a member of this house

    Example response:
        {
            "id": "789e0123-c45d-67e8-f901-234567890abc",
            "house_id": "123e4567-e89b-12d3-a456-426614174000",
            "code": "ABC123",
            "created_by": "987fcdeb-51a2-43f7-9876-543210987654",
            "expires_at": "2025-01-20T12:00:00Z",
            "is_valid": true,
            "created_at": "2025-01-13T12:00:00Z"
        }
    """
    # Check if user is member of this house
    membership = HouseService.check_user_membership(db, current_user.id, house_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this house"
        )

    # Check if house exists
    house = HouseService.get_house_by_id(db, house_id)
    if not house:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="House not found"
        )

    try:
        # Generate invitation
        invite = HouseService.create_invite(
            db=db,
            house_id=house_id,
            created_by=current_user.id
        )
        db.commit()

        return HouseInviteResponse(
            id=invite.id,
            house_id=invite.house_id,
            code=invite.code,
            created_by=invite.created_by,
            expires_at=invite.expires_at,
            is_valid=invite.is_valid,
            created_at=invite.created_at
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invitation: {str(e)}"
        )


@router.post(
    "/join",
    response_model=HouseDetailResponse,
    summary="Join house with invitation code",
    description="""
    Join a house using an invitation code.

    Steps:
    1. User receives code from existing member
    2. User submits code via this endpoint
    3. Code is validated (not used, not expired)
    4. User is added to house as MEMBER
    5. Code is marked as used

    The user must be authenticated but not already a member.
    """
)
def join_house(
    join_data: HouseJoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Join house using invitation code.

    Args:
        join_data: Request body with invitation code
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        House details with member list

    Raises:
        404: Invalid invitation code
        400: Code expired or already used
        400: User already member

    Example request:
        POST /api/v1/houses/join
        {
            "invite_code": "ABC123"
        }
    """
    try:
        house = HouseService.validate_and_use_invite(
            db=db,
            invite_code=join_data.invite_code,
            user_id=current_user.id
        )

        if not house:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invalid invitation code"
            )

        db.commit()

        # Get house with members for response
        house_data = HouseService.get_house_with_members(db, house.id)

        members = [
            HouseMemberResponse(
                user_id=m["user"].id,
                email=m["user"].email,
                full_name=m["user"].full_name,
                role=m["membership"].role,
                joined_at=m["membership"].joined_at
            )
            for m in house_data["members"]
        ]

        return HouseDetailResponse(
            id=house.id,
            owner_id=house.owner_id,
            name=house.name,
            description=house.description,
            location=house.location,
            settings=house.settings,
            created_at=house.created_at,
            updated_at=house.updated_at,
            members=members
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to join house: {str(e)}"
        )


@router.delete(
    "/{house_id}/members/{user_id}",
    response_model=HouseMemberRemoveResponse,
    summary="Remove member from house",
    description="""
    Remove a member from the house.

    Only the house owner can remove members.
    Cannot remove the house owner.

    The removed user will lose access to:
    - House information
    - House recipes
    - House meal history
    """
)
def remove_member(
    house_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove member from house.

    Args:
        house_id: House ID from URL path
        user_id: ID of user to remove from URL path
        current_user: Authenticated user (auto-injected)
        db: Database session (auto-injected)

    Returns:
        Removal confirmation

    Raises:
        404: House or user not found
        403: Only owner can remove members
        403: Cannot remove owner

    Example response:
        {
            "success": true,
            "message": "User successfully removed from house",
            "house_id": "123e4567-e89b-12d3-a456-426614174000",
            "removed_user_id": "456e7890-f12b-34c5-d678-901234567890"
        }
    """
    try:
        removed = HouseService.remove_member(
            db=db,
            house_id=house_id,
            user_id_to_remove=user_id,
            requester_id=current_user.id
        )

        if not removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="House or user not found"
            )

        db.commit()

        return HouseMemberRemoveResponse(
            success=True,
            message="User successfully removed from house",
            house_id=house_id,
            removed_user_id=user_id
        )

    except PermissionError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove member: {str(e)}"
        )
