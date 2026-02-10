"""
User Pydantic Schemas
Request and response models for user-related endpoints.

These schemas define the structure of data sent to and received from the API.
They provide automatic validation, serialization, and documentation.
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


# ============================================================================
# Authentication Schemas
# ============================================================================

class UserCreate(BaseModel):
    """
    Schema for user registration request.

    Used in POST /api/v1/auth/register endpoint.
    Validates user input before creating account.

    Example:
        {
            "email": "user@example.com",
            "password": "SecurePass123!",
            "full_name": "John Doe"
        }
    """
    email: EmailStr = Field(
        ...,
        description="Valid email address for authentication",
        examples=["user@example.com"]
    )
    password: str = Field(
        ...,
        min_length=8,
        description="Password (minimum 8 characters)",
        examples=["SecurePass123!"]
    )
    full_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="User's full name",
        examples=["John Doe"]
    )


class LoginRequest(BaseModel):
    """
    Schema for user login request.

    Used in POST /api/v1/auth/login endpoint.
    Accepts either email or username (full_name) as identifier.

    Example:
        {
            "identifier": "user@example.com",
            "password": "SecurePass123!"
        }
    """
    identifier: str = Field(
        ...,
        description="User's email address or username",
        examples=["user@example.com", "Gimmi"]
    )
    password: str = Field(
        ...,
        description="User's password",
        examples=["SecurePass123!"]
    )


class Token(BaseModel):
    """
    Schema for JWT token response.

    Returned by /register, /login, and /refresh endpoints.
    Contains both access token (short-lived) and refresh token (long-lived).

    Example:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer"
        }
    """
    access_token: str = Field(
        ...,
        description="JWT access token for API authentication"
    )
    refresh_token: str = Field(
        ...,
        description="JWT refresh token for obtaining new access tokens"
    )
    token_type: str = Field(
        default="bearer",
        description="Token type (always 'bearer' for JWT)"
    )


class RefreshTokenRequest(BaseModel):
    """
    Schema for refresh token request.

    Used in POST /api/v1/auth/refresh endpoint.

    Example:
        {
            "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
        }
    """
    refresh_token: str = Field(
        ...,
        description="Valid refresh token"
    )


# ============================================================================
# User Profile Schemas
# ============================================================================

class UserResponse(BaseModel):
    """
    Schema for user profile response.

    Used in GET /api/v1/users/me and other endpoints that return user data.
    Never includes password_hash (security).

    Example:
        {
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
    """
    id: UUID = Field(
        ...,
        description="Unique user identifier"
    )
    email: str = Field(
        ...,
        description="User's email address"
    )
    full_name: Optional[str] = Field(
        None,
        description="User's full name"
    )
    avatar_url: Optional[str] = Field(
        None,
        description="URL to user's avatar image"
    )
    preferences: Dict[str, Any] = Field(
        default_factory=dict,
        description="User preferences (allergies, goals, etc.)"
    )
    created_at: datetime = Field(
        ...,
        description="Account creation timestamp"
    )
    updated_at: datetime = Field(
        ...,
        description="Last profile update timestamp"
    )

    # Pydantic v2 configuration
    # orm_mode renamed to from_attributes in v2
    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    """
    Schema for user profile update request.

    Used in PUT /api/v1/users/me endpoint.
    All fields are optional - only provided fields will be updated.

    Example:
        {
            "full_name": "Jane Doe",
            "avatar_url": "https://example.com/new-avatar.jpg",
            "preferences": {
                "allergies": ["nuts", "lactose"],
                "daily_calorie_goal": 1800
            }
        }
    """
    full_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=255,
        description="Updated full name"
    )
    avatar_url: Optional[str] = Field(
        None,
        max_length=255,
        description="Updated avatar URL"
    )
    preferences: Optional[Dict[str, Any]] = Field(
        None,
        description="Updated preferences (completely replaces existing preferences)"
    )


class PasswordChangeRequest(BaseModel):
    """
    Schema for password change request.

    Used in PUT /api/v1/users/me/password endpoint (future implementation).

    Example:
        {
            "current_password": "OldPass123!",
            "new_password": "NewSecurePass456!"
        }
    """
    current_password: str = Field(
        ...,
        description="Current password for verification"
    )
    new_password: str = Field(
        ...,
        min_length=8,
        description="New password (minimum 8 characters)"
    )


# ============================================================================
# Helper Schemas
# ============================================================================

class TokenPayload(BaseModel):
    """
    Schema for JWT token payload (internal use).

    Used by auth_service to encode/decode JWT tokens.
    Not directly exposed to API endpoints.

    Token payload contains:
    - sub: Subject (user_id)
    - exp: Expiration timestamp
    - type: Token type (access or refresh)
    """
    sub: str = Field(
        ...,
        description="Subject (user ID)"
    )
    exp: int = Field(
        ...,
        description="Expiration timestamp (Unix)"
    )
    type: str = Field(
        ...,
        description="Token type (access or refresh)"
    )


# ============================================================================
# Password Recovery Schemas
# ============================================================================

class RecoverySetupRequest(BaseModel):
    """
    Schema for setting up password recovery PIN.

    Used in POST /api/v1/auth/setup-recovery endpoint.

    Example:
        {
            "recovery_pin": "123456",
            "recovery_pin_confirm": "123456"
        }
    """
    recovery_pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit numeric recovery PIN",
        examples=["123456"]
    )
    recovery_pin_confirm: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="Confirm recovery PIN (must match)",
        examples=["123456"]
    )


class RecoveryUpdateRequest(BaseModel):
    """
    Schema for updating password recovery PIN (requires current password).

    Used in PUT /api/v1/auth/update-recovery endpoint.
    """
    current_password: str = Field(
        ...,
        description="Current password for verification"
    )
    recovery_pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="New 6-digit recovery PIN"
    )
    recovery_pin_confirm: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="Confirm new recovery PIN"
    )


class RecoveryCheckRequest(BaseModel):
    """
    Schema for checking if user has recovery configured.

    Used in POST /api/v1/auth/check-recovery endpoint.
    """
    email: EmailStr = Field(
        ...,
        description="Email address to check recovery status for"
    )


class RecoveryCheckResponse(BaseModel):
    """
    Schema for recovery check response.
    """
    has_recovery: bool = Field(
        ...,
        description="Whether user has recovery configured"
    )


class PasswordResetRequest(BaseModel):
    """
    Schema for resetting password using recovery PIN.

    Used in POST /api/v1/auth/reset-password endpoint.
    """
    email: EmailStr = Field(
        ...,
        description="User's email address"
    )
    recovery_pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="6-digit recovery PIN"
    )
    new_password: str = Field(
        ...,
        min_length=8,
        description="New password (minimum 8 characters)"
    )
    new_password_confirm: str = Field(
        ...,
        min_length=8,
        description="Confirm new password"
    )


class FirstTimeResetRequest(BaseModel):
    """
    Schema for first-time password reset (users without recovery configured).

    Sets up recovery PIN and changes password in one step.
    Only works for users who have NOT configured recovery yet.
    """
    email: EmailStr = Field(
        ...,
        description="User's email address"
    )
    recovery_pin: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="New 6-digit recovery PIN to configure"
    )
    recovery_pin_confirm: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
        description="Confirm recovery PIN"
    )
    new_password: str = Field(
        ...,
        min_length=8,
        description="New password (minimum 8 characters)"
    )
    new_password_confirm: str = Field(
        ...,
        min_length=8,
        description="Confirm new password"
    )


class RecoveryStatusResponse(BaseModel):
    """
    Schema for recovery status response.
    """
    has_recovery_setup: bool = Field(
        ...,
        description="Whether user has configured password recovery"
    )
