# Implementazione Autenticazione JWT

## Overview

L'autenticazione JWT è stata completamente implementata per il backend FastAPI. Il sistema include registrazione utenti, login, refresh token e gestione profilo.

## Struttura File Creati

```
backend/app/
├── models/
│   └── user.py                   ✅ User SQLAlchemy model
├── schemas/
│   └── user.py                   ✅ Pydantic schemas (UserCreate, UserResponse, Token, etc.)
├── services/
│   ├── __init__.py               ✅ Services module init
│   └── auth_service.py           ✅ JWT creation, verification, user CRUD
├── api/
│   ├── __init__.py               ✅ API module init
│   └── v1/
│       ├── __init__.py           ✅ v1 API module init
│       ├── router.py             ✅ Main v1 router (aggregates all sub-routers)
│       ├── auth.py               ✅ POST /register, /login, /refresh
│       ├── users.py              ✅ GET /me, PUT /me, PUT /me/password
│       └── deps.py               ✅ get_current_user dependency
```

## Endpoint Implementati

### 1. POST /api/v1/auth/register
**Descrizione**: Registrazione nuovo utente

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "Mario Rossi"
}
```

**Response 201**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Validazioni**:
- Email deve essere valida e unica
- Password minimo 8 caratteri
- Full name obbligatorio

---

### 2. POST /api/v1/auth/login
**Descrizione**: Login e ottenimento token

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response 200**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Error 401**: Credenziali non valide

---

### 3. POST /api/v1/auth/refresh
**Descrizione**: Rinnovo access token usando refresh token

**Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response 200**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**Note**: Implementa refresh token rotation (il vecchio token diventa invalido)

---

### 4. GET /api/v1/users/me
**Descrizione**: Ottieni profilo utente corrente

**Headers**:
```
Authorization: Bearer <access_token>
```

**Response 200**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "full_name": "Mario Rossi",
  "avatar_url": null,
  "preferences": {},
  "created_at": "2024-01-13T10:30:00Z",
  "updated_at": "2024-01-13T10:30:00Z"
}
```

**Error 401**: Token mancante o non valido

---

### 5. PUT /api/v1/users/me
**Descrizione**: Aggiorna profilo utente corrente

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body** (tutti i campi opzionali):
```json
{
  "full_name": "Mario Verdi",
  "avatar_url": "https://example.com/avatar.jpg",
  "preferences": {
    "dietary_type": "vegetarian",
    "allergies": ["lactose"],
    "daily_calorie_target": 2000
  }
}
```

**Response 200**: User object aggiornato

---

### 6. PUT /api/v1/users/me/password
**Descrizione**: Cambia password

**Headers**:
```
Authorization: Bearer <access_token>
```

**Request Body**:
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass456!"
}
```

**Response 200**:
```json
{
  "message": "Password changed successfully"
}
```

**Error 400**: Password corrente non valida

---

## Modello User

### Campi Database (users table)

| Campo | Tipo | Nullable | Descrizione |
|-------|------|----------|-------------|
| id | UUID | NO | Primary key (auto-generated) |
| email | String(255) | NO | Email univoca (indexed) |
| password_hash | String(255) | NO | Password bcrypt hashed |
| full_name | String(255) | YES | Nome completo |
| avatar_url | String(255) | YES | URL avatar |
| preferences | JSON | NO | Preferenze utente (default: {}) |
| created_at | DateTime | NO | Data creazione |
| updated_at | DateTime | NO | Data ultimo aggiornamento |

### Esempio Preferences JSON
```json
{
  "dietary_type": "vegetarian",
  "allergies": ["nuts", "lactose"],
  "health_goals": ["weight_loss"],
  "daily_calorie_target": 2000,
  "macro_targets": {
    "proteins_g": 150,
    "carbs_g": 200,
    "fats_g": 65
  }
}
```

---

## JWT Configuration

### Access Token
- **Durata**: 3600 secondi (1 ora) - configurabile in `JWT_EXPIRATION`
- **Uso**: Autenticazione API requests
- **Header**: `Authorization: Bearer <access_token>`
- **Payload**:
  ```json
  {
    "sub": "user_id",
    "exp": 1234567890,
    "type": "access"
  }
  ```

### Refresh Token
- **Durata**: 604800 secondi (7 giorni) - configurabile in `REFRESH_TOKEN_EXPIRATION`
- **Uso**: Ottenere nuovi access token senza re-login
- **Payload**:
  ```json
  {
    "sub": "user_id",
    "exp": 1234567890,
    "type": "refresh"
  }
  ```

### Algoritmo
- **HS256** (HMAC with SHA-256)
- **Secret Key**: Da configurare in `.env` come `SECRET_KEY`

---

## Security Features

### Password Hashing
- Algoritmo: **bcrypt**
- Auto-salt generation
- Cost factor: default (può essere aumentato in futuro)
- Verifica tramite `passlib.context.CryptContext`

### Token Security
- Token firmati con secret key
- Validazione signature, expiration, e token type
- Refresh token rotation (token usato diventa invalido)
- Payload minimo (solo user_id, no dati sensibili)

### API Security
- Dependency injection per autenticazione
- HTTPBearer security scheme (auto-documented in Swagger)
- Error messages generici per login (no info leakage)
- HTTPS raccomandato in produzione

---

## Testing

### 1. Avvia il backend
```bash
cd backend
source venv/bin/activate  # se usi virtual env
uvicorn app.main:app --reload
```

### 2. Apri Swagger UI
```
http://localhost:8000/docs
```

### 3. Test Flow Completo

#### Step 1: Register
```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "full_name": "Test User"
  }'
```

Salva i token dalla response.

#### Step 2: Get Profile
```bash
curl -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer <access_token>"
```

#### Step 3: Update Profile
```bash
curl -X PUT "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Updated Name",
    "preferences": {
      "dietary_type": "vegetarian",
      "allergies": ["lactose"]
    }
  }'
```

#### Step 4: Login
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

#### Step 5: Refresh Token
```bash
curl -X POST "http://localhost:8000/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "<refresh_token>"
  }'
```

#### Step 6: Change Password
```bash
curl -X PUT "http://localhost:8000/api/v1/users/me/password" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "SecurePass123!",
    "new_password": "NewPass456!"
  }'
```

---

## Environment Variables

Assicurati che `.env` contenga:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/meal_planner_db

# Security
SECRET_KEY=your-super-secret-key-change-in-production
JWT_EXPIRATION=3600
REFRESH_TOKEN_EXPIRATION=604800

# Application
DEBUG=True
API_VERSION=v1
PROJECT_NAME=Meal Planner API
```

**IMPORTANTE**: Cambia `SECRET_KEY` in produzione con una chiave sicura:
```bash
# Genera secret key sicura
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Database Schema

La tabella `users` verrà creata automaticamente all'avvio dell'applicazione grazie a:

```python
# In main.py startup event
Base.metadata.create_all(bind=engine)
```

### SQL Schema Generato
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    preferences JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

---

## Prossimi Passi

### Per Task B3 (Houses):
L'autenticazione è pronta. Quando implementerai Houses:

1. Usa `get_current_user` dependency in tutti gli endpoint
2. Crea relazione User ↔ House tramite tabella `user_house`
3. Durante registrazione, crea automaticamente una "Mia Casa" default

### Esempio uso in nuovo endpoint:
```python
from app.api.v1.deps import get_current_user
from app.models.user import User

@router.get("/houses")
async def get_houses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # current_user è automaticamente autenticato
    houses = db.query(House).filter(
        House.members.any(id=current_user.id)
    ).all()
    return houses
```

---

## Troubleshooting

### Error: "Invalid or expired token"
- Token scaduto → usa refresh token
- Token malformato → rigenera con /login
- Secret key cambiata → tutti i token vecchi sono invalidi

### Error: "Email already registered"
- Email già esiste nel database
- Usa /login invece di /register

### Error: "Incorrect email or password"
- Credenziali non valide
- Password case-sensitive

### Error: "User not found"
- User cancellato ma token ancora valido
- Database resettato ma token ancora in uso

---

## API Documentation

Documentazione completa disponibile in:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

Swagger UI include:
- Schema dettagliato di tutti gli endpoint
- Esempi di request/response
- Try-it-out interattivo
- Autenticazione JWT integrata

---

## File Summary

### Backend Structure
```
backend/app/
├── main.py                       # FastAPI app + router registration
├── core/
│   ├── config.py                 # Settings (già esistente)
│   └── security.py               # Password hashing (già esistente)
├── db/
│   ├── base.py                   # SQLAlchemy Base (già esistente)
│   └── session.py                # Database session (già esistente)
├── models/
│   ├── __init__.py               # ✅ Aggiornato per esportare User
│   ├── base.py                   # BaseModel (già esistente)
│   └── user.py                   # ✅ NUOVO - User model
├── schemas/
│   ├── __init__.py               # ✅ NUOVO - Export user schemas
│   └── user.py                   # ✅ NUOVO - Pydantic schemas
├── services/
│   ├── __init__.py               # ✅ NUOVO
│   └── auth_service.py           # ✅ NUOVO - JWT + user CRUD
└── api/
    ├── __init__.py               # ✅ NUOVO
    └── v1/
        ├── __init__.py           # ✅ NUOVO
        ├── router.py             # ✅ NUOVO - Main v1 router
        ├── deps.py               # ✅ NUOVO - get_current_user
        ├── auth.py               # ✅ NUOVO - Auth endpoints
        └── users.py              # ✅ NUOVO - User endpoints
```

---

## Implementazione Completata ✅

- ✅ User SQLAlchemy model con preferenze JSON
- ✅ Password hashing con bcrypt
- ✅ JWT creation (access + refresh tokens)
- ✅ JWT verification con validazione type e expiration
- ✅ User CRUD operations (create, get, update, change_password)
- ✅ POST /api/v1/auth/register
- ✅ POST /api/v1/auth/login
- ✅ POST /api/v1/auth/refresh
- ✅ GET /api/v1/users/me
- ✅ PUT /api/v1/users/me
- ✅ PUT /api/v1/users/me/password
- ✅ get_current_user FastAPI dependency
- ✅ get_current_user_optional (per endpoint opzionali)
- ✅ Documentazione completa in Swagger
- ✅ Error handling appropriato
- ✅ Security best practices
- ✅ Commenti dettagliati in tutti i file

**Task B2 (Authentication) COMPLETATO** 🎉

Pronto per Task B3 (Houses) e successive feature!
