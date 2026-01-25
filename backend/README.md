# Meal Planner - Backend API

FastAPI-based REST API for the Meal Planner application.

## Features

- Multi-user authentication with JWT
- Recipe management with automatic nutritional calculations
- Meal tracking and history
- Grocy inventory integration
- Health and weight tracking
- Multi-house membership system

## Tech Stack

- **Framework**: FastAPI 0.109.0
- **Database**: PostgreSQL 14+
- **ORM**: SQLAlchemy 2.0
- **Validation**: Pydantic v2
- **Authentication**: JWT with bcrypt
- **Server**: Uvicorn

## Project Structure

```
backend/
├── app/
│   ├── core/          # Configuration, security, constants
│   ├── db/            # Database connection and base models
│   ├── models/        # SQLAlchemy ORM models
│   ├── schemas/       # Pydantic request/response schemas
│   ├── middleware/    # FastAPI middleware (CORS, etc.)
│   └── main.py        # FastAPI application entry point
├── requirements.txt   # Python dependencies
├── Dockerfile         # Container image definition
└── .env.example       # Environment variables template
```

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- pip or poetry

### Local Development Setup

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and settings
   ```

5. **Setup PostgreSQL database**
   ```bash
   # Create database
   createdb meal_planner_db

   # Or using psql
   psql -U postgres
   CREATE DATABASE meal_planner_db;
   ```

6. **Run the application**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

7. **Access the API**
   - API Root: http://localhost:8000
   - Health Check: http://localhost:8000/health
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Docker Deployment

### Build the image

```bash
docker build -t meal-planner-backend:latest .
```

### Run the container

```bash
docker run -d \
  --name meal-planner-backend \
  -p 8000:8000 \
  --env-file .env \
  meal-planner-backend:latest
```

### Docker Compose

See `docker-compose.yml` in the root directory for full stack deployment.

```bash
# From project root
docker-compose up -d
```

## Environment Variables

Required variables (create `.env` from `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/meal_planner_db

# Security
SECRET_KEY=your-super-secret-key-here  # Generate: openssl rand -hex 32
JWT_EXPIRATION=3600                     # 1 hour
REFRESH_TOKEN_EXPIRATION=604800         # 7 days

# Optional: Grocy Integration
GROCY_URL=http://your-grocy-instance:9283
GROCY_API_KEY=your-grocy-api-key
```

## API Documentation

### Available Endpoints

#### Health & Info
- `GET /` - API information and links
- `GET /health` - Health check endpoint

### Future Endpoints (To be implemented)

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token

#### Users
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update user profile

#### Houses
- `GET /api/v1/houses` - List user's houses
- `POST /api/v1/houses` - Create house
- `POST /api/v1/houses/{id}/invites` - Generate invite code
- `POST /api/v1/houses/join` - Join house with code

#### Recipes
- `GET /api/v1/recipes` - List recipes
- `POST /api/v1/recipes` - Create recipe
- `GET /api/v1/recipes/{id}` - Get recipe details
- `PUT /api/v1/recipes/{id}` - Update recipe
- `DELETE /api/v1/recipes/{id}` - Delete recipe

#### Meals
- `GET /api/v1/meals` - List meals
- `POST /api/v1/meals` - Log meal
- `GET /api/v1/meals/{id}` - Get meal details
- `DELETE /api/v1/meals/{id}` - Delete meal

#### Foods
- `GET /api/v1/foods` - Search foods (nutritional database)
- `GET /api/v1/foods/{id}` - Get food details

#### Health
- `POST /api/v1/weights` - Log weight
- `GET /api/v1/weights` - Get weight history
- `POST /api/v1/health` - Log health record
- `GET /api/v1/health` - Get health records

#### Grocy Integration
- `GET /api/v1/grocy/stock` - Get inventory stock
- `GET /api/v1/grocy/products` - Get products list

## Development

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

### Code Style

```bash
# Format code
black app/

# Sort imports
isort app/

# Lint
flake8 app/
```

### Database Migrations (Future)

```bash
# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Architecture Decisions

See `creation.txt` for detailed architectural decisions and implementation notes.

Key decisions:
- **FastAPI**: Modern, fast, with auto-documentation
- **PostgreSQL**: JSONB support for flexible ingredient storage
- **SQLAlchemy 2.0**: Modern ORM with excellent PostgreSQL support
- **UUID Primary Keys**: Security and distributed system benefits
- **JWT Authentication**: Stateless, scalable authentication
- **Bcrypt**: Secure password hashing with adaptive cost

## Project Status

**Current Phase**: Core Setup (Task B1) - ✅ COMPLETED

**Next Steps**:
- Task B2: Authentication implementation
- Task B3: House management and invites
- Task B4: Recipe and meal endpoints
- Task B5: Foods database and health tracking
- Task B6: Grocy API integration

## Security Notes

- Never commit `.env` file to version control
- Use strong, random `SECRET_KEY` in production
- Rotate JWT secret keys periodically
- Use HTTPS in production (reverse proxy)
- Restrict CORS origins in production
- Follow security best practices for database access

## Performance Considerations

- Adjust Uvicorn workers based on CPU cores: `(2 × cores) + 1`
- Enable connection pooling (configured by default)
- Consider Redis caching for frequently accessed data (Phase 2)
- Monitor database query performance with SQLAlchemy's `echo=True` in development

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Test connection
psql -U meal_planner -d meal_planner_db

# Check DATABASE_URL format
# Correct: postgresql://user:password@host:port/database
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Import Errors

```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Contributing

1. Follow existing code structure and style
2. Add comprehensive docstrings to all functions
3. Include type hints for all function signatures
4. Update this README with new features
5. Add tests for new functionality

## License

[Your License Here]

## Contact

For questions or issues, refer to:
- `SPEC.md` - Complete project specification
- `TASKS.md` - Task breakdown and dependencies
- `creation.txt` - Detailed implementation log
