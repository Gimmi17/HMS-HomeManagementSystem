#!/bin/bash

# ==============================================================================
# Meal Planner - Development Environment Setup Script
# ==============================================================================
# This script sets up the local development environment for Meal Planner
#
# Features:
# - Creates .env file from .env.example if it doesn't exist
# - Generates secure random SECRET_KEY
# - Starts all services in development mode with hot reload
# - Runs database migrations
# - Imports food data from CSV (if available)
#
# Usage:
#   ./scripts/setup_dev.sh
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Change to project root directory
cd "$(dirname "$0")/.."

print_header "Meal Planner - Development Setup"

# ==============================================================================
# Step 1: Check if .env exists
# ==============================================================================
print_info "Step 1: Checking environment configuration..."

if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."

    if [ ! -f .env.example ]; then
        print_error ".env.example not found! Cannot proceed."
        exit 1
    fi

    # Copy .env.example to .env
    cp .env.example .env
    print_success "Created .env file"

    # Generate secure SECRET_KEY
    print_info "Generating secure SECRET_KEY..."
    if command -v openssl &> /dev/null; then
        SECRET_KEY=$(openssl rand -hex 32)
        # Replace placeholder in .env
        sed -i.bak "s/your-super-secret-key-change-in-production-use-openssl-rand-hex-32/$SECRET_KEY/" .env
        rm .env.bak
        print_success "Generated SECRET_KEY"
    else
        print_warning "openssl not found. Please manually set SECRET_KEY in .env"
    fi

    # Generate secure DB_PASSWORD
    print_info "Generating secure DB_PASSWORD..."
    if command -v openssl &> /dev/null; then
        DB_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
        sed -i.bak "s/your-secure-password-change-me/$DB_PASSWORD/" .env
        rm .env.bak
        print_success "Generated DB_PASSWORD"
    else
        print_warning "openssl not found. Please manually set DB_PASSWORD in .env"
    fi

    print_warning "IMPORTANT: Please edit .env and configure:"
    print_warning "  - GROCY_URL (your Grocy instance URL)"
    print_warning "  - GROCY_API_KEY (your Grocy API key)"
    echo ""
    read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
else
    print_success ".env file already exists"
fi

# ==============================================================================
# Step 2: Check Docker and Docker Compose
# ==============================================================================
print_info "Step 2: Checking Docker installation..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

print_success "Docker and docker-compose are installed"

# ==============================================================================
# Step 3: Stop existing containers (if any)
# ==============================================================================
print_info "Step 3: Stopping existing containers..."

docker-compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
print_success "Stopped existing containers"

# ==============================================================================
# Step 4: Build and start containers
# ==============================================================================
print_info "Step 4: Building and starting containers in development mode..."

print_info "This may take a few minutes on first run..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

print_success "Containers started successfully"

# ==============================================================================
# Step 5: Wait for services to be ready
# ==============================================================================
print_info "Step 5: Waiting for services to be ready..."

# Wait for PostgreSQL to be ready
print_info "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U meal_planner &> /dev/null; then
        print_success "PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_error "PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# Wait for backend to be ready
print_info "Waiting for backend API..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health &> /dev/null; then
        print_success "Backend API is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        print_warning "Backend API is taking longer than expected to start"
        break
    fi
    sleep 1
done

# ==============================================================================
# Step 6: Run database migrations (if alembic is used)
# ==============================================================================
print_info "Step 6: Checking database migrations..."

# Check if alembic is configured
if docker-compose exec -T backend ls alembic.ini &> /dev/null; then
    print_info "Running database migrations..."
    docker-compose exec -T backend alembic upgrade head || print_warning "Migrations not yet configured"
else
    print_info "Alembic not configured. Tables will be created automatically on first run."
fi

# ==============================================================================
# Step 7: Import food data from CSV (if available)
# ==============================================================================
print_info "Step 7: Checking for food data..."

if [ -f ../nutrizione_pulito.csv ]; then
    print_info "Found nutrizione_pulito.csv. Importing food data..."
    # Copy CSV to backend container and run import script
    docker cp ../nutrizione_pulito.csv meal-planner-backend:/tmp/nutrizione_pulito.csv
    docker-compose exec -T backend python -m app.db.seed || print_warning "Food import script not yet implemented"
    print_success "Food data imported"
elif [ -f backend/data/nutrizione_pulito.csv ]; then
    print_info "Found nutrizione_pulito.csv in backend/data. Importing..."
    docker-compose exec -T backend python -m app.db.seed || print_warning "Food import script not yet implemented"
else
    print_warning "Food data CSV not found. You'll need to import it manually later."
fi

# ==============================================================================
# Step 8: Display status and URLs
# ==============================================================================
print_header "Setup Complete!"

echo ""
print_success "All services are running in development mode"
echo ""
print_info "Service URLs:"
echo "  Frontend:    http://localhost:3000"
echo "  Backend API: http://localhost:8000"
echo "  API Docs:    http://localhost:8000/docs"
echo "  ReDoc:       http://localhost:8000/redoc"
echo "  PostgreSQL:  localhost:5432 (user: meal_planner)"
echo ""
print_info "Development features enabled:"
echo "  ✓ Hot reload for backend (FastAPI)"
echo "  ✓ Hot reload for frontend (Vite)"
echo "  ✓ PostgreSQL exposed on port 5432"
echo "  ✓ Source code mounted as volumes"
echo ""
print_info "Useful commands:"
echo "  View logs:           docker-compose logs -f"
echo "  View backend logs:   docker-compose logs -f backend"
echo "  View frontend logs:  docker-compose logs -f frontend"
echo "  Stop services:       docker-compose down"
echo "  Restart services:    docker-compose restart"
echo "  Rebuild:             docker-compose up -d --build"
echo ""
print_warning "Remember to configure GROCY_URL and GROCY_API_KEY in .env if not done yet!"
echo ""
print_success "Happy coding! 🚀"
