"""
Authentication Service
Handles JWT token creation, verification, and user authentication.

This service provides core authentication functionality:
- JWT token generation (access + refresh tokens)
- Token verification and decoding
- User authentication (login)
- User registration with password hashing
- User CRUD operations
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate, TokenPayload


# JWT Configuration
# Algorithm used for signing tokens (HS256 = HMAC with SHA-256)
ALGORITHM = "HS256"


# ============================================================================
# JWT Token Functions
# ============================================================================

def create_access_token(user_id: UUID) -> str:
    """
    Create a JWT access token for a user.

    Access tokens are short-lived (default: 1 hour) and used for authenticating
    API requests. They should be included in the Authorization header.

    Args:
        user_id: UUID of the user to create token for

    Returns:
        Encoded JWT token string

    Example:
        token = create_access_token(user.id)
        # Use in header: Authorization: Bearer {token}
    """
    # Calculate expiration time
    expire = datetime.utcnow() + timedelta(seconds=settings.JWT_EXPIRATION)

    # Create token payload
    payload = {
        "sub": str(user_id),  # Subject (user ID)
        "exp": expire,  # Expiration time
        "type": "access"  # Token type
    }

    # Encode and sign the token
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(user_id: UUID) -> str:
    """
    Create a JWT refresh token for a user.

    Refresh tokens are long-lived (default: 7 days) and used to obtain new
    access tokens without requiring the user to login again.

    Args:
        user_id: UUID of the user to create token for

    Returns:
        Encoded JWT refresh token string

    Example:
        refresh = create_refresh_token(user.id)
        # Use to get new access token via /api/v1/auth/refresh
    """
    # Calculate expiration time (7 days by default)
    expire = datetime.utcnow() + timedelta(seconds=settings.REFRESH_TOKEN_EXPIRATION)

    # Create token payload
    payload = {
        "sub": str(user_id),  # Subject (user ID)
        "exp": expire,  # Expiration time
        "type": "refresh"  # Token type
    }

    # Encode and sign the token
    encoded_jwt = jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str, expected_type: str = "access") -> Optional[TokenPayload]:
    """
    Verify and decode a JWT token.

    Validates token signature, expiration, and type.
    Returns the token payload if valid, None otherwise.

    Args:
        token: JWT token string to verify
        expected_type: Expected token type ("access" or "refresh")

    Returns:
        TokenPayload if token is valid, None if invalid

    Example:
        payload = verify_token(token, "access")
        if payload:
            user_id = UUID(payload.sub)
    """
    try:
        # Decode and verify token signature
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])

        # Extract token data
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        exp: int = payload.get("exp")

        # Validate required fields
        if not user_id or not token_type or not exp:
            return None

        # Validate token type
        if token_type != expected_type:
            return None

        # Create and return payload object
        return TokenPayload(
            sub=user_id,
            exp=exp,
            type=token_type
        )

    except JWTError:
        # Token is invalid (bad signature, expired, malformed, etc.)
        return None


# ============================================================================
# User Authentication Functions
# ============================================================================

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate a user by email and password.

    Verifies user credentials and returns the user object if valid.

    Args:
        db: Database session
        email: User's email address
        password: Plain text password to verify

    Returns:
        User object if credentials are valid, None otherwise

    Example:
        user = authenticate_user(db, "user@example.com", "password123")
        if user:
            token = create_access_token(user.id)
    """
    # Find user by email
    user = db.query(User).filter(User.email == email).first()

    # If user not found or password incorrect, return None
    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    return user


# ============================================================================
# User CRUD Functions
# ============================================================================

def create_user(db: Session, user_data: UserCreate) -> User:
    """
    Create a new user account.

    Hashes the password before storing and creates a new user record.

    Args:
        db: Database session
        user_data: UserCreate schema with email, password, and full_name

    Returns:
        Created User object with all fields populated

    Raises:
        IntegrityError: If email already exists in database

    Example:
        user_data = UserCreate(
            email="user@example.com",
            password="SecurePass123!",
            full_name="John Doe"
        )
        user = create_user(db, user_data)
    """
    # Hash the password using bcrypt
    password_hash = hash_password(user_data.password)

    # Create new user instance
    user = User(
        email=user_data.email,
        password_hash=password_hash,
        full_name=user_data.full_name,
        preferences={}  # Default empty preferences
    )

    # Add to database and commit
    db.add(user)
    db.commit()
    db.refresh(user)  # Refresh to get generated id and timestamps

    return user


def get_user_by_id(db: Session, user_id: UUID) -> Optional[User]:
    """
    Get user by ID.

    Args:
        db: Database session
        user_id: UUID of the user to retrieve

    Returns:
        User object if found, None otherwise

    Example:
        user = get_user_by_id(db, user_id)
        if user:
            print(user.email)
    """
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """
    Get user by email address.

    Args:
        db: Database session
        email: Email address to search for

    Returns:
        User object if found, None otherwise

    Example:
        user = get_user_by_email(db, "user@example.com")
        if user:
            print("User exists")
    """
    return db.query(User).filter(User.email == email).first()


def update_user(db: Session, user_id: UUID, user_data: UserUpdate) -> Optional[User]:
    """
    Update user profile.

    Only updates fields that are provided in user_data.
    Fields set to None are not updated.

    Args:
        db: Database session
        user_id: UUID of user to update
        user_data: UserUpdate schema with fields to update

    Returns:
        Updated User object if found, None if user doesn't exist

    Example:
        update_data = UserUpdate(
            full_name="Jane Doe",
            preferences={"daily_calorie_goal": 1800}
        )
        user = update_user(db, user_id, update_data)
    """
    # Get user from database
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    # Update only provided fields
    update_dict = user_data.model_dump(exclude_unset=True)

    for field, value in update_dict.items():
        setattr(user, field, value)

    # Commit changes
    db.commit()
    db.refresh(user)

    return user


def change_password(db: Session, user_id: UUID, current_password: str, new_password: str) -> bool:
    """
    Change user's password.

    Verifies current password before changing to new password.

    Args:
        db: Database session
        user_id: UUID of user changing password
        current_password: Current password for verification
        new_password: New password to set

    Returns:
        True if password changed successfully, False if current password is wrong

    Example:
        success = change_password(db, user_id, "OldPass123", "NewPass456")
        if success:
            print("Password changed")
    """
    # Get user
    user = get_user_by_id(db, user_id)
    if not user:
        return False

    # Verify current password
    if not verify_password(current_password, user.password_hash):
        return False

    # Hash new password and update
    user.password_hash = hash_password(new_password)
    db.commit()

    return True
