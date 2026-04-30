"""
User Profile Endpoints
Handles user profile retrieval and updates.

Endpoints:
- GET /users/me - Get current user profile
- PUT /users/me - Update current user profile
- PUT /users/me/password - Change password (future implementation)

All endpoints require authentication via JWT token.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.db.session import get_db
from app.models.user import User
from app.models.biometric_profile import BiometricProfile
from app.schemas.user import UserResponse, UserUpdate, PasswordChangeRequest, UserAnagraficaUpdate, UserAnagraficaResponse
from app.services import auth_service
from app.api.v1.deps import get_current_user


# Create router for user endpoints
# This router will be included in the main app with prefix /api/v1/users
router = APIRouter()


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
    description="Returns profile information for the authenticated user",
    responses={
        200: {
            "description": "User profile retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "email": "user@example.com",
                        "full_name": "John Doe",
                        "avatar_url": "https://example.com/avatar.jpg",
                        "preferences": {
                            "allergies": ["nuts"],
                            "daily_calorie_goal": 2000
                        },
                        "created_at": "2024-01-13T10:30:00Z",
                        "updated_at": "2024-01-13T10:30:00Z"
                    }
                }
            }
        },
        401: {
            "description": "Not authenticated or invalid token"
        }
    }
)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
) -> UserResponse:
    """
    Get current user profile.

    Returns complete profile information for the authenticated user.
    Requires valid JWT access token in Authorization header.

    Authentication:
    - Requires: JWT access token
    - Header: Authorization: Bearer <token>

    Returns:
    - id: User's unique identifier (UUID)
    - email: User's email address
    - full_name: User's display name
    - avatar_url: URL to user's avatar image (if set)
    - preferences: User preferences as JSON object
    - created_at: Account creation timestamp
    - updated_at: Last profile update timestamp

    Security:
    - Password hash is NEVER returned
    - Only authenticated user can see their own profile

    Example:
        GET /api/v1/users/me
        Headers:
            Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

        Response 200:
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "user@example.com",
            "full_name": "John Doe",
            "avatar_url": null,
            "preferences": {},
            "created_at": "2024-01-13T10:30:00Z",
            "updated_at": "2024-01-13T10:30:00Z"
        }
    """
    # current_user is automatically populated by get_current_user dependency
    # It extracts user from JWT token and retrieves from database
    return current_user


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
    description="Update profile information for the authenticated user",
    responses={
        200: {
            "description": "Profile updated successfully"
        },
        401: {
            "description": "Not authenticated or invalid token"
        },
        422: {
            "description": "Validation error (invalid data)"
        }
    }
)
async def update_current_user_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> UserResponse:
    """
    Update current user profile.

    Allows authenticated user to update their profile information.
    Only provided fields are updated (partial updates allowed).

    Authentication:
    - Requires: JWT access token
    - Header: Authorization: Bearer <token>

    Request Body (all fields optional):
    - full_name: Updated display name
    - avatar_url: Updated avatar URL
    - preferences: Updated preferences object (completely replaces existing)

    Returns:
    - Updated user profile

    Notes:
    - Email cannot be changed (use separate endpoint for that)
    - Password cannot be changed here (use /users/me/password)
    - Preferences are replaced entirely (not merged)
    - Only provided fields are updated

    Example:
        PUT /api/v1/users/me
        Headers:
            Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
        Body:
        {
            "full_name": "Jane Doe",
            "preferences": {
                "allergies": ["nuts", "lactose"],
                "daily_calorie_goal": 1800,
                "dietary_restrictions": ["vegetarian"]
            }
        }

        Response 200:
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "user@example.com",
            "full_name": "Jane Doe",
            "avatar_url": null,
            "preferences": {
                "allergies": ["nuts", "lactose"],
                "daily_calorie_goal": 1800,
                "dietary_restrictions": ["vegetarian"]
            },
            "created_at": "2024-01-13T10:30:00Z",
            "updated_at": "2024-01-13T15:45:00Z"
        }
    """
    # Update user profile using auth_service
    updated_user = auth_service.update_user(db, current_user.id, user_data)

    if not updated_user:
        # This shouldn't happen (current_user exists), but handle gracefully
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return updated_user


@router.put(
    "/me/password",
    status_code=status.HTTP_200_OK,
    summary="Change password",
    description="Change user password (requires current password)",
    responses={
        200: {
            "description": "Password changed successfully",
            "content": {
                "application/json": {
                    "example": {"message": "Password changed successfully"}
                }
            }
        },
        400: {
            "description": "Current password is incorrect",
            "content": {
                "application/json": {
                    "example": {"detail": "Current password is incorrect"}
                }
            }
        },
        401: {
            "description": "Not authenticated or invalid token"
        },
        422: {
            "description": "Validation error (new password too short)"
        }
    }
)
async def change_user_password(
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change user password.

    Allows authenticated user to change their password.
    Requires current password for security verification.

    Authentication:
    - Requires: JWT access token
    - Header: Authorization: Bearer <token>

    Request Body:
    - current_password: User's current password (for verification)
    - new_password: New password (minimum 8 characters)

    Returns:
    - Success message if password changed

    Errors:
    - 400: Current password is incorrect
    - 401: Not authenticated
    - 422: New password too short or invalid

    Security:
    - Requires current password to prevent unauthorized changes
    - New password is hashed with bcrypt before storage
    - Existing sessions remain valid (tokens not invalidated)

    Example:
        PUT /api/v1/users/me/password
        Headers:
            Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
        Body:
        {
            "current_password": "OldPass123!",
            "new_password": "NewSecurePass456!"
        }

        Response 200:
        {
            "message": "Password changed successfully"
        }

    Note: After password change, consider logging out and re-authenticating
    for security, though existing tokens remain valid until expiration.
    """
    # Change password using auth_service
    success = auth_service.change_password(
        db,
        current_user.id,
        password_data.current_password,
        password_data.new_password
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    return {"message": "Password changed successfully"}


# ============================================================================
# ANAGRAFICA ENDPOINTS
# ============================================================================

@router.get(
    "/me/anagrafica",
    response_model=UserAnagraficaResponse,
    summary="Get user anagrafica",
    description="Returns personal/registry data for the authenticated user",
)
async def get_user_anagrafica(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserAnagraficaResponse:
    """Get user anagrafica — merge of preferences['anagrafica'] + biometric profile."""
    prefs = current_user.preferences or {}
    ana   = prefs.get("anagrafica", {})

    # Cross-reference biometric profile for health fields if not set in anagrafica
    bio = db.query(BiometricProfile).filter(
        BiometricProfile.user_id == current_user.id
    ).first()

    birth_date  = ana.get("birth_date")  or (str(bio.birth_date) if bio and bio.birth_date else None)
    gender      = ana.get("gender")      or (bio.biological_sex  if bio else None)
    height_cm   = ana.get("height_cm")   or (float(bio.height_cm) if bio and bio.height_cm else None)

    # Parse full_name into first/last if dedicated fields are empty
    first_name = ana.get("first_name", "")
    last_name  = ana.get("last_name", "")
    if not first_name and not last_name and current_user.full_name:
        parts = current_user.full_name.split(" ", 1)
        first_name = parts[0]
        last_name  = parts[1] if len(parts) > 1 else ""

    return UserAnagraficaResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        first_name=first_name or None,
        last_name=last_name or None,
        codice_fiscale=ana.get("codice_fiscale"),
        birth_date=birth_date,
        birth_place=ana.get("birth_place"),
        gender=gender,
        height_cm=height_cm,
        phone=ana.get("phone"),
        address=ana.get("address"),
        blood_type=ana.get("blood_type"),
        allergies_medical=ana.get("allergies_medical", []),
        emergency_contact_name=ana.get("emergency_contact_name"),
        emergency_contact_phone=ana.get("emergency_contact_phone"),
        notes=ana.get("notes"),
    )


@router.put(
    "/me/anagrafica",
    response_model=UserAnagraficaResponse,
    summary="Update user anagrafica",
    description="Update personal/registry data (merges with existing, does not replace)",
)
async def update_user_anagrafica(
    data: UserAnagraficaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserAnagraficaResponse:
    """Update user anagrafica via preferences['anagrafica'] merge."""
    prefs = dict(current_user.preferences or {})
    ana   = dict(prefs.get("anagrafica", {}))

    # Merge only provided fields
    update_dict = data.model_dump(exclude_none=True)
    ana.update(update_dict)
    prefs["anagrafica"] = ana

    # Also update full_name if first/last changed
    first = ana.get("first_name", "")
    last  = ana.get("last_name", "")
    if first or last:
        new_full = f"{first} {last}".strip()
        current_user.full_name = new_full

    current_user.preferences = prefs
    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Also sync birth_date + gender to biometric profile if changed
    if "birth_date" in update_dict or "gender" in update_dict:
        bio = db.query(BiometricProfile).filter(
            BiometricProfile.user_id == current_user.id
        ).first()
        if bio:
            from datetime import date
            if "birth_date" in update_dict and update_dict["birth_date"]:
                try:
                    bio.birth_date = date.fromisoformat(update_dict["birth_date"])
                except ValueError:
                    pass
            if "gender" in update_dict:
                bio.biological_sex = update_dict["gender"]
            db.add(bio)
            db.commit()

    # Re-fetch to return updated data
    db.refresh(current_user)
    return await get_user_anagrafica(current_user=current_user, db=db)


# Future endpoints to implement:
# - DELETE /me - Delete account (soft delete)
# - POST /me/avatar - Upload avatar image
# - GET /users/{user_id} - Get public profile of other users (for house members)
