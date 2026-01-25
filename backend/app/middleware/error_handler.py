"""
Error Handler Middleware

FastAPI middleware that catches all unhandled exceptions
and logs them using the error logging service.
"""

import traceback
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.error_logging import error_logger


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Middleware that catches all unhandled exceptions and logs them.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response

        except HTTPException as http_exc:
            # Log HTTP exceptions (4xx, 5xx)
            if http_exc.status_code >= 500:
                # Server errors - log as error
                error_logger.log_error(
                    http_exc,
                    request=request,
                    user=getattr(request.state, 'user', None),
                    severity="error",
                    context={"status_code": http_exc.status_code, "detail": http_exc.detail}
                )
            elif http_exc.status_code >= 400:
                # Client errors - log as warning (optional, can be noisy)
                pass  # Don't log 4xx errors by default

            return JSONResponse(
                status_code=http_exc.status_code,
                content={"detail": http_exc.detail}
            )

        except Exception as exc:
            # Unhandled exceptions - log as critical
            error_id = error_logger.log_error(
                exc,
                request=request,
                user=getattr(request.state, 'user', None),
                severity="critical",
                context={"unhandled": True}
            )

            # Return generic error response with error ID for reference
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Si è verificato un errore interno. Contatta l'amministratore.",
                    "error_id": str(error_id) if error_id else None
                }
            )


async def log_request_errors(request: Request, call_next):
    """
    Simple error logging middleware function.
    Alternative to the class-based middleware.
    """
    try:
        return await call_next(request)
    except Exception as exc:
        error_logger.log_error(
            exc,
            request=request,
            user=getattr(request.state, 'user', None),
            severity="critical"
        )
        raise
