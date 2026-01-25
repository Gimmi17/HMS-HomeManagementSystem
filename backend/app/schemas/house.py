"""
House Pydantic Schemas
Defines request and response models for house-related API endpoints.

These schemas handle:
- Request validation (ensuring required fields are present)
- Response serialization (converting DB models to JSON)
- Type checking and data coercion
- API documentation generation

Pydantic automatically generates JSON Schema for OpenAPI/Swagger docs.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


# ============================================================================
# Base Schemas (shared fields)
# ============================================================================

class HouseBase(BaseModel):
    """Base house schema with common fields."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Display name for the house",
        example="Casa Rossi"
    )
    description: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional description of the house and its members",
        example="Famiglia Rossi - 4 persone"
    )
    location: Optional[str] = Field(
        None,
        max_length=255,
        description="Physical location (city, address, etc)",
        example="Milano, Italia"
    )


# ============================================================================
# Request Schemas (for incoming data)
# ============================================================================

class HouseCreate(HouseBase):
    """
    Schema for creating a new house.

    The creator automatically becomes the house owner.
    Owner_id is taken from the authenticated user, not from request body.

    Example request body:
        {
            "name": "Casa Rossi",
            "description": "Famiglia Rossi - 4 persone",
            "location": "Milano, Italia"
        }
    """
    settings: Optional[dict] = Field(
        default_factory=dict,
        description="House settings (timezone, notifications, etc)",
        example={
            "timezone": "Europe/Rome",
            "notifications": {
                "meal_reminders": True
            }
        }
    )


class HouseUpdate(BaseModel):
    """
    Schema for updating house information.

    All fields are optional - only provided fields will be updated.
    Only the house owner can perform updates.

    Example request body:
        {
            "name": "Casa Verdi",
            "settings": {
                "timezone": "Europe/Paris"
            }
        }
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=255)
    settings: Optional[dict] = None


class HouseJoinRequest(BaseModel):
    """
    Schema for joining a house using an invitation code.

    Example request body:
        {
            "invite_code": "ABC123"
        }
    """
    invite_code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        description="6-character invitation code",
        example="ABC123"
    )

    @validator('invite_code')
    def uppercase_code(cls, v):
        """Ensure code is uppercase for case-insensitive matching."""
        return v.upper() if v else v


# ============================================================================
# Response Schemas (for outgoing data)
# ============================================================================

class HouseMemberResponse(BaseModel):
    """
    Schema for house member information in responses.

    Included in house detail responses to show all members.
    """
    user_id: UUID = Field(..., description="User's unique identifier")
    email: str = Field(..., description="User's email address")
    full_name: Optional[str] = Field(None, description="User's display name")
    role: str = Field(..., description="Role in house: OWNER, MEMBER, GUEST")
    joined_at: datetime = Field(..., description="When user joined the house")

    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)
        json_schema_extra = {
            "example": {
                "user_id": "123e4567-e89b-12d3-a456-426614174000",
                "email": "mario.rossi@example.com",
                "full_name": "Mario Rossi",
                "role": "MEMBER",
                "joined_at": "2025-01-13T10:30:00Z"
            }
        }


class HouseResponse(HouseBase):
    """
    Schema for house information in list responses.

    Basic house info without members list (lighter payload).
    Used in GET /houses endpoint.
    """
    id: UUID = Field(..., description="House unique identifier")
    owner_id: UUID = Field(..., description="User who owns this house")
    settings: dict = Field(default_factory=dict, description="House settings")
    created_at: datetime = Field(..., description="House creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "owner_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "name": "Casa Rossi",
                "description": "Famiglia Rossi",
                "location": "Milano, Italia",
                "settings": {"timezone": "Europe/Rome"},
                "created_at": "2025-01-01T12:00:00Z",
                "updated_at": "2025-01-10T15:30:00Z"
            }
        }


class HouseDetailResponse(HouseResponse):
    """
    Schema for detailed house information including members.

    Used in GET /houses/{id} endpoint.
    Extends HouseResponse with members list.
    """
    members: List[HouseMemberResponse] = Field(
        default_factory=list,
        description="List of house members with their roles"
    )

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "owner_id": "987fcdeb-51a2-43f7-9876-543210987654",
                "name": "Casa Rossi",
                "description": "Famiglia Rossi",
                "location": "Milano, Italia",
                "settings": {"timezone": "Europe/Rome"},
                "created_at": "2025-01-01T12:00:00Z",
                "updated_at": "2025-01-10T15:30:00Z",
                "members": [
                    {
                        "user_id": "987fcdeb-51a2-43f7-9876-543210987654",
                        "email": "owner@example.com",
                        "full_name": "Mario Rossi",
                        "role": "OWNER",
                        "joined_at": "2025-01-01T12:00:00Z"
                    },
                    {
                        "user_id": "456e7890-f12b-34c5-d678-901234567890",
                        "email": "member@example.com",
                        "full_name": "Laura Bianchi",
                        "role": "MEMBER",
                        "joined_at": "2025-01-05T14:20:00Z"
                    }
                ]
            }
        }


# ============================================================================
# Invitation Schemas
# ============================================================================

class HouseInviteCreate(BaseModel):
    """
    Schema for creating a house invitation.

    Request body can be empty - defaults will be used.
    Expiration is automatically set to 7 days from now.

    Example request body:
        {}  # Empty body, all defaults
    """
    pass  # No fields needed, all auto-generated


class HouseInviteResponse(BaseModel):
    """
    Schema for invitation code response.

    Returned after generating an invitation.
    Contains the code to share and expiration info.
    """
    id: UUID = Field(..., description="Invite unique identifier")
    house_id: UUID = Field(..., description="House this invitation is for")
    code: str = Field(..., description="6-character invitation code")
    created_by: UUID = Field(..., description="User who created this invite")
    expires_at: datetime = Field(..., description="When this invite expires")
    is_valid: bool = Field(..., description="Whether invite can still be used")
    created_at: datetime = Field(..., description="Invite creation timestamp")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "789e0123-c45d-67e8-f901-234567890abc",
                "house_id": "123e4567-e89b-12d3-a456-426614174000",
                "code": "ABC123",
                "created_by": "987fcdeb-51a2-43f7-9876-543210987654",
                "expires_at": "2025-01-20T12:00:00Z",
                "is_valid": True,
                "created_at": "2025-01-13T12:00:00Z"
            }
        }


# ============================================================================
# Delete/Remove Schemas
# ============================================================================

class HouseMemberRemoveResponse(BaseModel):
    """
    Schema for member removal confirmation.

    Returned after successfully removing a member.
    """
    success: bool = Field(..., description="Whether removal was successful")
    message: str = Field(..., description="Human-readable message")
    house_id: UUID = Field(..., description="House ID")
    removed_user_id: UUID = Field(..., description="ID of removed user")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "User successfully removed from house",
                "house_id": "123e4567-e89b-12d3-a456-426614174000",
                "removed_user_id": "456e7890-f12b-34c5-d678-901234567890"
            }
        }
