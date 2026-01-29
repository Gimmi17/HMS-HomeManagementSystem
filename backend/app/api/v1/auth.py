"""
Authentication Endpoints
Handles user registration, login, and token refresh.

Endpoints:
- POST /auth/register - Create new user account
- POST /auth/login - Authenticate and get tokens
- POST /auth/refresh - Get new access token using refresh token
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

from app.db.session import get_db
from app.services.error_logging import error_logger

# Logger for auth events
auth_logger = logging.getLogger("auth")


class LoginFailedError(Exception):
    """Exception for failed login attempts (for error buffer logging)."""
    pass
from app.schemas.user import (
    UserCreate,
    LoginRequest,
    Token,
    RefreshTokenRequest,
    UserResponse,
    RecoverySetupRequest,
    RecoveryUpdateRequest,
    RecoveryCheckRequest,
    RecoveryCheckResponse,
    PasswordResetRequest,
    RecoveryStatusResponse
)
from app.services import auth_service
from app.api.v1.deps import get_current_user
from app.models.user import User


# Create router for authentication endpoints
# This router will be included in the main app with prefix /api/v1/auth
router = APIRouter()


@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Register new user",
    description="Create a new user account and return authentication tokens",
    responses={
        201: {
            "description": "User created successfully",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIs...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
                        "token_type": "bearer"
                    }
                }
            }
        },
        400: {
            "description": "Email already registered",
            "content": {
                "application/json": {
                    "example": {"detail": "Email already registered"}
                }
            }
        },
        422: {
            "description": "Validation error (invalid email, short password, etc.)"
        }
    }
)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
) -> Token:
    """
    Register a new user account.

    Creates a new user with hashed password and returns JWT tokens
    for immediate authentication.

    Flow:
    1. Validate user input (email format, password length, etc.)
    2. Check if email already exists
    3. Hash password using bcrypt
    4. Create user record in database
    5. Generate access and refresh tokens
    6. Return tokens

    Request Body:
    - email: Valid email address (must be unique)
    - password: Password (minimum 8 characters)
    - full_name: User's full name

    Returns:
    - access_token: Short-lived JWT for API requests (1 hour)
    - refresh_token: Long-lived JWT for refreshing access token (7 days)
    - token_type: Always "bearer"

    Errors:
    - 400: Email already exists
    - 422: Invalid input (email format, password too short, etc.)

    Example:
        POST /api/v1/auth/register
        {
            "email": "user@example.com",
            "password": "SecurePass123!",
            "full_name": "John Doe"
        }

        Response 201:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer"
        }
    """
    # Check if email already exists
    existing_user = auth_service.get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    try:
        # Create new user (password is hashed in auth_service)
        user = auth_service.create_user(db, user_data)

        # Generate JWT tokens
        access_token = auth_service.create_access_token(user.id)
        refresh_token = auth_service.create_refresh_token(user.id)

        # Return tokens
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer"
        )

    except IntegrityError:
        # Database constraint violation (shouldn't happen due to check above)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )


@router.post(
    "/login",
    response_model=Token,
    summary="Login user",
    description="Authenticate user with email and password, return tokens",
    responses={
        200: {
            "description": "Login successful",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIs...",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
                        "token_type": "bearer"
                    }
                }
            }
        },
        401: {
            "description": "Invalid credentials",
            "content": {
                "application/json": {
                    "example": {"detail": "Incorrect email or password"}
                }
            }
        }
    }
)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> Token:
    """
    Authenticate user and get JWT tokens.

    Verifies email and password, then returns tokens for authenticated requests.

    Flow:
    1. Find user by email
    2. Verify password using bcrypt
    3. Generate new access and refresh tokens
    4. Return tokens

    Request Body:
    - email: User's email address
    - password: User's password (plain text, verified against hashed password)

    Returns:
    - access_token: JWT for API requests (1 hour expiration)
    - refresh_token: JWT for token refresh (7 days expiration)
    - token_type: Always "bearer"

    Errors:
    - 401: Email not found or password incorrect

    Example:
        POST /api/v1/auth/login
        {
            "email": "user@example.com",
            "password": "SecurePass123!"
        }

        Response 200:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer"
        }

    Security:
    - Password is never returned in response
    - Failed login doesn't reveal if email exists (generic error message)
    - Token payload contains only user_id (no sensitive data)
    """
    # Extract client info for logging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Log login attempt
    auth_logger.info(
        f"LOGIN_ATTEMPT | email={credentials.email} | ip={client_ip} | user_agent={user_agent}"
    )

    # Authenticate user (returns None if email/password wrong)
    user = auth_service.authenticate_user(db, credentials.email, credentials.password)

    if not user:
        # Log failed attempt
        auth_logger.warning(
            f"LOGIN_FAILED | email={credentials.email} | ip={client_ip} | "
            f"user_agent={user_agent} | reason=invalid_credentials"
        )
        # Log to error buffer for detailed tracking
        error_logger.log_error(
            LoginFailedError(f"Failed login attempt for email: {credentials.email}"),
            request=request,
            severity="warning",
            context={
                "email": credentials.email,
                "reason": "invalid_credentials",
                "client_ip": client_ip,
                "user_agent": user_agent
            },
            save_to_db=True
        )
        # Don't reveal if email exists or password wrong (security best practice)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Generate new tokens
    access_token = auth_service.create_access_token(user.id)
    refresh_token = auth_service.create_refresh_token(user.id)

    # Log successful login
    auth_logger.info(
        f"LOGIN_SUCCESS | email={credentials.email} | user_id={user.id} | ip={client_ip} | "
        f"user_agent={user_agent}"
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post(
    "/refresh",
    response_model=Token,
    summary="Refresh access token",
    description="Get new access token using refresh token",
    responses={
        200: {
            "description": "Tokens refreshed successfully"
        },
        401: {
            "description": "Invalid or expired refresh token",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid or expired refresh token"}
                }
            }
        }
    }
)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
) -> Token:
    """
    Refresh access token using refresh token.

    When access token expires (after 1 hour), use this endpoint to get
    a new access token without requiring the user to login again.

    Flow:
    1. Verify refresh token signature and expiration
    2. Extract user_id from token
    3. Verify user still exists
    4. Generate new access and refresh tokens
    5. Return new tokens

    Request Body:
    - refresh_token: Valid refresh token (obtained from /login or /register)

    Returns:
    - access_token: New JWT for API requests
    - refresh_token: New refresh token (extends session)
    - token_type: Always "bearer"

    Errors:
    - 401: Refresh token invalid, expired, or user not found

    Example:
        POST /api/v1/auth/refresh
        {
            "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
        }

        Response 200:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIs...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
            "token_type": "bearer"
        }

    Notes:
    - Both access and refresh tokens are regenerated (refresh token rotation)
    - Old refresh token becomes invalid after use (security best practice)
    - If refresh token expires (after 7 days), user must login again
    """
    # Verify refresh token
    payload = auth_service.verify_token(
        refresh_data.refresh_token,
        expected_type="refresh"
    )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Extract user_id from token
    try:
        from uuid import UUID
        user_id = UUID(payload.sub)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Verify user still exists
    user = auth_service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Generate new tokens (refresh token rotation)
    access_token = auth_service.create_access_token(user.id)
    new_refresh_token = auth_service.create_refresh_token(user.id)

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer"
    )


# ============================================================================
# Password Recovery Endpoints
# ============================================================================

@router.post(
    "/setup-recovery",
    response_model=RecoveryStatusResponse,
    summary="Setup password recovery",
    description="Configure recovery PIN for password recovery",
    responses={
        200: {
            "description": "Recovery setup successful"
        },
        400: {
            "description": "Invalid input (PINs don't match, etc.)"
        }
    }
)
async def setup_recovery(
    data: RecoverySetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> RecoveryStatusResponse:
    """
    Set up password recovery PIN for the current user.

    Requires:
    - 6-digit numeric recovery PIN (+ confirmation)

    The PIN is hashed before storage (never stored in plain text).
    """
    # Verify PINs match
    if data.recovery_pin != data.recovery_pin_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="I PIN di recupero non coincidono"
        )

    # Set up recovery
    success = auth_service.setup_recovery(
        db,
        current_user.id,
        data.recovery_pin
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Errore durante la configurazione del recupero"
        )

    auth_logger.info(
        f"RECOVERY_SETUP | user_id={current_user.id} | email={current_user.email}"
    )

    return RecoveryStatusResponse(has_recovery_setup=True)


@router.get(
    "/recovery-status",
    response_model=RecoveryStatusResponse,
    summary="Get recovery status",
    description="Check if current user has recovery configured"
)
async def get_recovery_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> RecoveryStatusResponse:
    """
    Get recovery configuration status for the current user.
    """
    status_data = auth_service.get_recovery_status(db, current_user.id)
    return RecoveryStatusResponse(**status_data)


@router.post(
    "/check-recovery",
    response_model=RecoveryCheckResponse,
    summary="Check if user has recovery configured",
    description="Check if a user has recovery PIN configured (public endpoint)"
)
async def check_recovery(
    data: RecoveryCheckRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> RecoveryCheckResponse:
    """
    Check if user has recovery configured for an email address.

    Used during password recovery flow to verify recovery is available.
    """
    client_ip = request.client.host if request.client else "unknown"

    # Check if user has recovery configured
    has_recovery = auth_service.has_recovery_configured(db, data.email)

    auth_logger.info(
        f"RECOVERY_CHECK | email={data.email} | ip={client_ip} | has_recovery={has_recovery}"
    )

    return RecoveryCheckResponse(has_recovery=has_recovery)


@router.post(
    "/reset-password",
    summary="Reset password with recovery PIN",
    description="Reset password using recovery PIN",
    responses={
        200: {
            "description": "Password reset successful"
        },
        400: {
            "description": "Invalid PIN or passwords don't match"
        }
    }
)
async def reset_password(
    data: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Reset password using recovery PIN.

    Requires:
    - Email address
    - 6-digit recovery PIN
    - New password (+ confirmation)
    """
    client_ip = request.client.host if request.client else "unknown"

    # Verify passwords match
    if data.new_password != data.new_password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le password non coincidono"
        )

    # Attempt password reset
    success = auth_service.reset_password_with_recovery(
        db,
        data.email,
        data.recovery_pin,
        data.new_password
    )

    if not success:
        auth_logger.warning(
            f"PASSWORD_RESET_FAILED | email={data.email} | ip={client_ip} | "
            f"reason=invalid_recovery_pin"
        )
        error_logger.log_error(
            Exception(f"Failed password reset attempt for email: {data.email}"),
            request=request,
            severity="warning",
            context={
                "email": data.email,
                "reason": "invalid_recovery_pin",
                "client_ip": client_ip
            },
            save_to_db=True
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN di recupero non valido"
        )

    auth_logger.info(
        f"PASSWORD_RESET_SUCCESS | email={data.email} | ip={client_ip}"
    )

    return {"message": "Password aggiornata con successo"}


@router.put(
    "/update-recovery",
    response_model=RecoveryStatusResponse,
    summary="Update recovery PIN",
    description="Update recovery PIN (requires current password)"
)
async def update_recovery(
    data: RecoveryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> RecoveryStatusResponse:
    """
    Update password recovery PIN.

    Requires current password for verification.
    """
    # Verify PINs match
    if data.recovery_pin != data.recovery_pin_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="I PIN di recupero non coincidono"
        )

    # Update recovery settings
    success = auth_service.update_recovery(
        db,
        current_user.id,
        data.current_password,
        data.recovery_pin
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password attuale non valida"
        )

    auth_logger.info(
        f"RECOVERY_UPDATE | user_id={current_user.id} | email={current_user.email}"
    )

    return RecoveryStatusResponse(has_recovery_setup=True)
