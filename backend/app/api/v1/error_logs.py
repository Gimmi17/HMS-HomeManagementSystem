"""
Error Logs API Endpoints

Admin-only endpoints for viewing and managing error logs.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.models.user import User, UserRole
from app.models.error_log import ErrorLog


router = APIRouter(prefix="/error-logs")


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that requires admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso riservato agli amministratori"
        )
    return current_user


class ErrorLogSummary(BaseModel):
    """Summary view of error log."""
    id: UUID
    timestamp: datetime
    error_type: str
    severity: str
    message: str
    user_email: Optional[str] = None
    request_path: Optional[str] = None
    resolved: str

    class Config:
        from_attributes = True


class ErrorLogDetail(BaseModel):
    """Detailed view of error log."""
    id: UUID
    timestamp: datetime
    error_type: str
    error_code: Optional[str] = None
    severity: str
    module: Optional[str] = None
    function: Optional[str] = None
    line_number: Optional[str] = None
    user_id: Optional[UUID] = None
    user_email: Optional[str] = None
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    request_query: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None
    message: str
    error_buffer: Optional[str] = None
    stack_trace: Optional[str] = None
    context_data: Optional[dict] = None
    resolved: str
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorLogListResponse(BaseModel):
    """Response for error log list."""
    errors: List[ErrorLogSummary]
    total: int
    limit: int
    offset: int


class ResolveErrorRequest(BaseModel):
    """Request to resolve an error."""
    resolution_notes: Optional[str] = None


class ErrorStats(BaseModel):
    """Error statistics."""
    total_errors: int
    unresolved_errors: int
    errors_today: int
    errors_by_severity: dict
    top_error_types: List[dict]


@router.get("", response_model=ErrorLogListResponse)
def get_error_logs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    error_type: Optional[str] = Query(None, description="Filter by error type"),
    resolved: Optional[str] = Query(None, description="Filter by resolved status (Y/N)"),
    user_email: Optional[str] = Query(None, description="Filter by user email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get all error logs (admin only).
    """
    query = db.query(ErrorLog)

    # Apply filters
    if severity:
        query = query.filter(ErrorLog.severity == severity)
    if error_type:
        query = query.filter(ErrorLog.error_type.ilike(f"%{error_type}%"))
    if resolved:
        query = query.filter(ErrorLog.resolved == resolved.upper())
    if user_email:
        query = query.filter(ErrorLog.user_email.ilike(f"%{user_email}%"))

    # Get total count
    total = query.count()

    # Get errors with pagination (most recent first)
    errors = query.order_by(ErrorLog.timestamp.desc()).offset(offset).limit(limit).all()

    return ErrorLogListResponse(
        errors=[ErrorLogSummary(
            id=e.id,
            timestamp=e.timestamp,
            error_type=e.error_type,
            severity=e.severity,
            message=e.message[:200] + "..." if len(e.message) > 200 else e.message,
            user_email=e.user_email,
            request_path=e.request_path,
            resolved=e.resolved
        ) for e in errors],
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/stats", response_model=ErrorStats)
def get_error_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get error statistics (admin only).
    """
    from sqlalchemy import func
    from datetime import date

    # Total errors
    total_errors = db.query(func.count(ErrorLog.id)).scalar()

    # Unresolved errors
    unresolved_errors = db.query(func.count(ErrorLog.id)).filter(
        ErrorLog.resolved == 'N'
    ).scalar()

    # Errors today
    today = date.today()
    errors_today = db.query(func.count(ErrorLog.id)).filter(
        func.date(ErrorLog.timestamp) == today
    ).scalar()

    # Errors by severity
    severity_counts = db.query(
        ErrorLog.severity,
        func.count(ErrorLog.id)
    ).group_by(ErrorLog.severity).all()
    errors_by_severity = {s: c for s, c in severity_counts}

    # Top error types (last 7 days)
    from datetime import timedelta
    week_ago = datetime.now() - timedelta(days=7)
    top_types = db.query(
        ErrorLog.error_type,
        func.count(ErrorLog.id).label('count')
    ).filter(
        ErrorLog.timestamp >= week_ago
    ).group_by(ErrorLog.error_type).order_by(
        func.count(ErrorLog.id).desc()
    ).limit(10).all()

    return ErrorStats(
        total_errors=total_errors or 0,
        unresolved_errors=unresolved_errors or 0,
        errors_today=errors_today or 0,
        errors_by_severity=errors_by_severity,
        top_error_types=[{"type": t, "count": c} for t, c in top_types]
    )


@router.get("/{error_id}", response_model=ErrorLogDetail)
def get_error_log(
    error_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get a single error log with full details (admin only).
    """
    error = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()

    if not error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Error log non trovato"
        )

    return error


@router.post("/{error_id}/resolve", response_model=ErrorLogDetail)
def resolve_error(
    error_id: UUID,
    data: ResolveErrorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Mark an error as resolved (admin only).
    """
    error = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()

    if not error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Error log non trovato"
        )

    error.resolved = 'Y'
    error.resolved_at = datetime.now()
    error.resolved_by = current_user.id
    error.resolution_notes = data.resolution_notes

    db.commit()
    db.refresh(error)

    return error


@router.delete("/{error_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_error_log(
    error_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete an error log (admin only).
    """
    error = db.query(ErrorLog).filter(ErrorLog.id == error_id).first()

    if not error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Error log non trovato"
        )

    db.delete(error)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_resolved_errors(
    older_than_days: int = Query(30, ge=1, description="Delete resolved errors older than N days"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete all resolved errors older than specified days (admin only).
    """
    from datetime import timedelta

    cutoff = datetime.now() - timedelta(days=older_than_days)

    deleted = db.query(ErrorLog).filter(
        ErrorLog.resolved == 'Y',
        ErrorLog.timestamp < cutoff
    ).delete()

    db.commit()

    return {"deleted": deleted}
