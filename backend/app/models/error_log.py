"""
Error Log Model
Stores application errors for debugging and monitoring.

Captures comprehensive error information including:
- Timestamp
- User context
- Request details
- Full error traceback
- Additional context data
"""

from sqlalchemy import Column, String, Text, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone

from app.models.base import BaseModel


class ErrorLog(BaseModel):
    """
    Error Log Model

    Stores detailed error information for debugging and monitoring.
    Each error is uniquely identified and contains all context needed
    to understand and reproduce the issue.
    """
    __tablename__ = "error_logs"

    # Timestamp when error occurred
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    # Error classification
    error_type = Column(String(255), nullable=False, index=True)  # e.g., "ValueError", "HTTPException"
    error_code = Column(String(50), nullable=True)  # HTTP status code or custom error code
    severity = Column(String(20), default="error", nullable=False)  # debug, info, warning, error, critical

    # Location info
    module = Column(String(255), nullable=True)  # e.g., "app.api.v1.shopping_lists"
    function = Column(String(255), nullable=True)  # e.g., "verify_item_with_quantity"
    line_number = Column(String(20), nullable=True)

    # User context (nullable for unauthenticated requests)
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)

    # Request context
    request_method = Column(String(10), nullable=True)  # GET, POST, PUT, DELETE
    request_path = Column(String(500), nullable=True)
    request_query = Column(Text, nullable=True)  # Query string
    request_body = Column(Text, nullable=True)  # Request body (sanitized)
    request_headers = Column(JSON, nullable=True)  # Selected headers
    client_ip = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # Error details
    message = Column(Text, nullable=False)  # Short error message
    error_buffer = Column(Text, nullable=True)  # Full error output/traceback
    stack_trace = Column(Text, nullable=True)  # Full stack trace

    # Additional context
    context_data = Column(JSON, nullable=True)  # Any additional data for debugging

    # Resolution tracking
    resolved = Column(String(1), default='N', nullable=False)  # Y/N
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ErrorLog(id={self.id}, type={self.error_type}, message={self.message[:50]}...)>"
