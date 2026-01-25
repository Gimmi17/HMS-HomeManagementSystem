"""
Security Utilities
Handles password hashing and verification using bcrypt.

This module provides secure password hashing functionality using passlib
with bcrypt algorithm for storing user passwords safely.
"""

from passlib.context import CryptContext


# Password hashing context using bcrypt
# bcrypt is recommended for password hashing due to its:
# - Adaptive nature (cost factor can be increased over time)
# - Built-in salt generation
# - Resistance to rainbow table attacks
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hash a plain text password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string (safe to store in database)

    Example:
        >>> hashed = hash_password("mySecurePassword123")
        >>> print(hashed)  # $2b$12$...
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain text password against a hashed password.

    Args:
        plain_password: Plain text password from user input
        hashed_password: Hashed password from database

    Returns:
        True if password matches, False otherwise

    Example:
        >>> hashed = hash_password("myPassword")
        >>> verify_password("myPassword", hashed)  # True
        >>> verify_password("wrongPassword", hashed)  # False
    """
    return pwd_context.verify(plain_password, hashed_password)
