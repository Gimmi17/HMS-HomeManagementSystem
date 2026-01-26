# OCR Service - PaddleOCR Microservice
# Separate container for heavy OCR processing

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PaddleOCR
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies (this will take a while due to PaddlePaddle)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app.py .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

# Run service
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
