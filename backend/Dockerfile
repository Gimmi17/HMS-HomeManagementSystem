# Meal Planner Backend - Docker Image
# Multi-stage build for optimized production image

# =============================================================================
# Stage 1: Base Python image with dependencies
# =============================================================================
FROM python:3.11-slim AS base

# Set working directory inside container
WORKDIR /app

# Install system dependencies required for PostgreSQL, cryptography, and PaddleOCR
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    g++ \
    libpq-dev \
    # PaddleOCR dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Development image (with hot reload support)
# =============================================================================
FROM base AS development

# Copy application code
COPY ./app /app/app
COPY ./data /app/data

# Expose port 8000 for FastAPI
EXPOSE 8000

# Run with hot reload for development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# =============================================================================
# Stage 3: Production image
# =============================================================================
FROM python:3.11-slim AS production

# Set working directory
WORKDIR /app

# Install only runtime dependencies (not build tools)
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq5 \
    # PaddleOCR runtime dependencies
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from base stage
COPY --from=base /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=base /usr/local/bin /usr/local/bin

# Copy application code
COPY ./app /app/app
COPY ./data /app/data

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port 8000 for FastAPI
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Run FastAPI application with Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
