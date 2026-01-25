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

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserResponse, UserUpdate, PasswordChangeRequest
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


# Future endpoints to implement:
# - DELETE /me - Delete account (soft delete)
# - POST /me/avatar - Upload avatar image
# - GET /users/{user_id} - Get public profile of other users (for house members)
