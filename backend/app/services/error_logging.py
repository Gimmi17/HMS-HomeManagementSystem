"""
Error Logging Service

Comprehensive error logging system that:
- Writes to log files with rotation
- Stores errors in database for querying
- Captures full context (user, request, traceback)
- Sanitizes sensitive data

Usage:
    from app.services.error_logging import error_logger

    try:
        # some code
    except Exception as e:
        error_logger.log_error(e, request=request, user=current_user)
"""

import logging
import traceback
import json
import sys
import os
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from uuid import UUID
from pathlib import Path
from logging.handlers import RotatingFileHandler

from sqlalchemy.orm import Session

from app.models.error_log import ErrorLog


# Create logs directory with error handling
LOGS_DIR = Path("/app/logs")
FILE_LOGGING_ENABLED = False

try:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    # Test if we can write to the directory
    test_file = LOGS_DIR / ".write_test"
    test_file.touch()
    test_file.unlink()
    FILE_LOGGING_ENABLED = True
except (PermissionError, OSError) as e:
    print(f"Warning: Cannot write to logs directory {LOGS_DIR}: {e}")
    print("File logging disabled, using console only.")

# Configure file handlers only if directory is writable
file_handler = None
detailed_handler = None

if FILE_LOGGING_ENABLED:
    # Configure file logger
    file_handler = RotatingFileHandler(
        LOGS_DIR / "errors.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=10,  # Keep 10 backup files
        encoding='utf-8'
    )
    file_handler.setLevel(logging.ERROR)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s | %(levelname)s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))

    # Configure detailed file logger (all levels)
    detailed_handler = RotatingFileHandler(
        LOGS_DIR / "app_detailed.log",
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding='utf-8'
    )
    detailed_handler.setLevel(logging.DEBUG)
    detailed_handler.setFormatter(logging.Formatter(
    '%(asctime)s | %(levelname)s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))

# Get root logger and add handlers (only if file logging is enabled)
root_logger = logging.getLogger()
if file_handler:
    root_logger.addHandler(file_handler)
if detailed_handler:
    root_logger.addHandler(detailed_handler)

# Create specific error logger
logger = logging.getLogger("error_logging")
logger.setLevel(logging.DEBUG)


# Sensitive fields to sanitize
SENSITIVE_FIELDS = {'password', 'password_hash', 'token', 'access_token', 'refresh_token',
                     'authorization', 'api_key', 'secret', 'credential'}


def sanitize_data(data: Any, depth: int = 0) -> Any:
    """
    Sanitize sensitive data from dictionaries and strings.
    Replaces sensitive field values with '[REDACTED]'.
    """
    if depth > 10:  # Prevent infinite recursion
        return "[MAX_DEPTH]"

    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            key_lower = key.lower()
            if any(sensitive in key_lower for sensitive in SENSITIVE_FIELDS):
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = sanitize_data(value, depth + 1)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_data(item, depth + 1) for item in data]
    elif isinstance(data, str):
        # Check for common sensitive patterns
        if len(data) > 20 and data.startswith("eyJ"):  # JWT token pattern
            return "[REDACTED_TOKEN]"
        return data
    else:
        return data


def truncate_string(s: str, max_length: int = 10000) -> str:
    """Truncate string to max length."""
    if len(s) > max_length:
        return s[:max_length] + f"... [TRUNCATED, total {len(s)} chars]"
    return s


class ErrorLogger:
    """
    Error logging service that writes to both file and database.
    """

    def __init__(self):
        self.db_session_factory = None

    def set_db_session_factory(self, factory):
        """Set the database session factory for DB logging."""
        self.db_session_factory = factory

    def log_error(
        self,
        error: Exception,
        request: Optional[Any] = None,
        user: Optional[Any] = None,
        severity: str = "error",
        context: Optional[Dict] = None,
        save_to_db: bool = True
    ) -> Optional[UUID]:
        """
        Log an error with full context.

        Args:
            error: The exception that occurred
            request: FastAPI Request object (optional)
            user: Current user object (optional)
            severity: debug, info, warning, error, critical
            context: Additional context data
            save_to_db: Whether to save to database

        Returns:
            UUID of the error log entry if saved to DB, None otherwise
        """
        timestamp = datetime.now(timezone.utc)

        # Extract error information
        error_type = type(error).__name__
        error_message = str(error)

        # Get full traceback
        exc_type, exc_value, exc_tb = sys.exc_info()
        if exc_tb:
            stack_trace = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
            # Get location info from traceback
            tb_info = traceback.extract_tb(exc_tb)
            if tb_info:
                last_frame = tb_info[-1]
                module = last_frame.filename
                function = last_frame.name
                line_number = str(last_frame.lineno)
            else:
                module = function = line_number = None
        else:
            stack_trace = traceback.format_exc()
            module = function = line_number = None

        # Build error buffer with all available info
        error_buffer_parts = [
            f"=== ERROR LOG ===",
            f"Timestamp: {timestamp.isoformat()}",
            f"Type: {error_type}",
            f"Message: {error_message}",
            f"Severity: {severity}",
        ]

        # Extract request info
        request_method = request_path = request_query = None
        request_body = request_headers = client_ip = user_agent = None

        if request:
            try:
                request_method = request.method
                request_path = str(request.url.path)
                request_query = str(request.url.query) if request.url.query else None
                client_ip = request.client.host if request.client else None
                user_agent = request.headers.get("user-agent")

                # Get selected headers (sanitized)
                safe_headers = {}
                for key in ['content-type', 'accept', 'accept-language', 'x-request-id']:
                    if key in request.headers:
                        safe_headers[key] = request.headers[key]
                request_headers = safe_headers if safe_headers else None

                error_buffer_parts.extend([
                    f"\n=== REQUEST ===",
                    f"Method: {request_method}",
                    f"Path: {request_path}",
                    f"Query: {request_query}",
                    f"Client IP: {client_ip}",
                    f"User Agent: {user_agent}",
                ])
            except Exception as req_err:
                error_buffer_parts.append(f"\n[Failed to extract request info: {req_err}]")

        # Extract user info
        user_id = user_email = None
        if user:
            try:
                user_id = user.id
                user_email = user.email
                error_buffer_parts.extend([
                    f"\n=== USER ===",
                    f"ID: {user_id}",
                    f"Email: {user_email}",
                ])
            except Exception:
                pass

        # Add context
        if context:
            sanitized_context = sanitize_data(context)
            error_buffer_parts.extend([
                f"\n=== CONTEXT ===",
                json.dumps(sanitized_context, indent=2, default=str),
            ])

        # Add stack trace
        error_buffer_parts.extend([
            f"\n=== STACK TRACE ===",
            stack_trace,
        ])

        error_buffer = "\n".join(error_buffer_parts)
        error_buffer = truncate_string(error_buffer, 50000)  # Max 50KB

        # Log to file
        log_message = f"{error_type}: {error_message} | User: {user_email or 'anonymous'} | Path: {request_path or 'N/A'}"

        if severity == "critical":
            logger.critical(log_message)
        elif severity == "error":
            logger.error(log_message)
        elif severity == "warning":
            logger.warning(log_message)
        else:
            logger.info(log_message)

        # Write detailed error to separate file (only if file logging is enabled)
        if FILE_LOGGING_ENABLED:
            error_file = LOGS_DIR / "errors_detailed.log"
            try:
                with open(error_file, "a", encoding="utf-8") as f:
                    f.write(f"\n{'='*80}\n")
                    f.write(error_buffer)
                    f.write(f"\n{'='*80}\n")
            except Exception as file_err:
                logger.error(f"Failed to write to error file: {file_err}")

        # Save to database
        error_log_id = None
        if save_to_db and self.db_session_factory:
            try:
                db = self.db_session_factory()
                try:
                    error_log = ErrorLog(
                        timestamp=timestamp,
                        error_type=error_type,
                        error_code=getattr(error, 'status_code', None),
                        severity=severity,
                        module=module,
                        function=function,
                        line_number=line_number,
                        user_id=user_id,
                        user_email=user_email,
                        request_method=request_method,
                        request_path=request_path,
                        request_query=request_query,
                        request_body=truncate_string(str(request_body), 5000) if request_body else None,
                        request_headers=request_headers,
                        client_ip=client_ip,
                        user_agent=truncate_string(user_agent, 500) if user_agent else None,
                        message=truncate_string(error_message, 1000),
                        error_buffer=error_buffer,
                        stack_trace=truncate_string(stack_trace, 20000),
                        context_data=sanitize_data(context) if context else None,
                    )
                    db.add(error_log)
                    db.commit()
                    db.refresh(error_log)
                    error_log_id = error_log.id
                    logger.debug(f"Error logged to DB with ID: {error_log_id}")
                finally:
                    db.close()
            except Exception as db_err:
                logger.error(f"Failed to save error to database: {db_err}")

        return error_log_id

    def log_warning(self, message: str, **kwargs):
        """Log a warning message."""
        logger.warning(message)
        if kwargs.get('save_to_db') and self.db_session_factory:
            # Create a simple warning log entry
            class WarningException(Exception):
                pass
            self.log_error(
                WarningException(message),
                severity="warning",
                **kwargs
            )

    def log_info(self, message: str):
        """Log an info message."""
        logger.info(message)


# Singleton instance
error_logger = ErrorLogger()


def configure_error_logging(db_session_factory):
    """
    Configure the error logging system with database support.
    Call this during app startup.
    """
    error_logger.set_db_session_factory(db_session_factory)
    logger.info("Error logging system configured")
