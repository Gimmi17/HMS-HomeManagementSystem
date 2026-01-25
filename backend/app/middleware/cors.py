"""
CORS Middleware Configuration
Enables Cross-Origin Resource Sharing for frontend-backend communication.

CORS is required when the frontend (React on port 3000) needs to make
requests to the backend API (FastAPI on port 8000) during development.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for the FastAPI application.

    This allows the frontend application to make cross-origin requests
    to the backend API during development and production.

    Args:
        app: FastAPI application instance

    CORS Configuration:
    - allow_origins: List of allowed origin URLs
    - allow_credentials: Allow cookies and authentication headers
    - allow_methods: HTTP methods permitted (GET, POST, PUT, DELETE, etc.)
    - allow_headers: HTTP headers allowed in requests

    Development vs Production:
    - Development: Permissive settings for localhost (port 3000)
    - Production: Should be restricted to specific frontend domain
    """

    # Allowed origins (frontend URLs)
    # In development: Allow localhost on common ports
    # In production: Update this to include only your production domain
    origins = [
        "http://localhost:3000",  # React dev server default port
        "http://127.0.0.1:3000",  # Alternative localhost format
        "http://localhost:5173",  # Vite dev server default port
        "http://localhost:5052",  # Custom port
        "http://127.0.0.1:5052",  # Alternative localhost format
        "http://192.168.1.52:5052",  # Local network IP
        "https://mp.gimmidefranceschi.casa",  # Cloudflare tunnel frontend
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,  # List of allowed origins
        allow_credentials=True,  # Allow cookies and auth headers
        allow_methods=["*"],  # Allow all HTTP methods (GET, POST, PUT, DELETE, etc.)
        allow_headers=["*"],  # Allow all headers (Content-Type, Authorization, etc.)
    )
