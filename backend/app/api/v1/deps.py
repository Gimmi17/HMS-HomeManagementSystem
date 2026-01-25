"""
API Dependencies
Common dependencies used across API endpoints.

This module provides:
- Database session management
- User authentication (JWT validation)
- Permission checks

Dependencies are injected into FastAPI endpoints using Depends().
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import verify_token, get_user_by_id


# HTTP Bearer token scheme for JWT authentication
# Used to extract "Authorization: Bearer <token>" from request headers
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Extract and validate current user from JWT token.

    This dependency:
    1. Extracts JWT token from Authorization header
    2. Validates token signature and expiration
    3. Extracts user_id from token payload
    4. Loads user from database
    5. Returns User object

    Args:
        credentials: HTTP Bearer credentials (auto-injected by FastAPI)
        db: Database session (auto-injected by FastAPI)

    Returns:
        User object for authenticated user

    Raises:
        HTTPException 401: If token is invalid or expired
        HTTPException 404: If user not found in database

    Usage in endpoint:
        @router.get("/profile")
        def get_profile(current_user: User = Depends(get_current_user)):
            return {"email": current_user.email}
    """
    # Extract token from credentials
    token = credentials.credentials

    # Verify token signature and expiration
    payload = verify_token(token, expected_type="access")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Get user from database
    user_id = UUID(payload.sub)
    user = get_user_by_id(db, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utente non trovato"
        )

    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Extract current user if authenticated, otherwise return None.

    Same as get_current_user but doesn't raise exception if no token provided.
    Useful for endpoints that have different behavior for authenticated users
    but are also accessible to anonymous users.

    Args:
        credentials: HTTP Bearer credentials (optional)
        db: Database session

    Returns:
        User object if authenticated, None if not

    Usage:
        @router.get("/items")
        def list_items(user: Optional[User] = Depends(get_current_user_optional)):
            if user:
                # Show personalized items
                return get_user_items(user.id)
            else:
                # Show public items
                return get_public_items()
    """
    if credentials is None:
        return None

    try:
        return get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None
