# Meal Planner - Task Parallelizzabili

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TASK INDIPENDENTI                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FRONTEND (3 task)          BACKEND (6 task)      INFRA (1)    │
│  ┌─────────────────┐        ┌─────────────────┐   ┌─────────┐  │
│  │ F1: Recipe Form │        │ B1: Core Setup  │   │ I1:     │  │
│  │ F2: Meal Form   │        │ B2: Auth        │   │ Docker  │  │
│  │ F3: Recipe View │        │ B3: Houses      │   │ Compose │  │
│  └─────────────────┘        │ B4: Recipes     │   └─────────┘  │
│                             │ B5: Foods+Health│                 │
│                             │ B6: Grocy       │                 │
│                             └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# FRONTEND TASKS

## F1: Recipe Form (Creazione/Modifica Ricetta)

**Path**: `frontend/src/pages/RecipeForm.tsx`
**Complessità**: Media-Alta
**Dipendenze**: Nessuna (usa mock se backend non pronto)

### Requisiti
- Form per creare/modificare ricetta
- Autocomplete ingredienti (search da `/api/v1/foods`)
- Aggiunta dinamica ingredienti con quantità (grammi)
- Calcolo nutrizionale in tempo reale (somma nutrienti ingredienti)
- Campi: nome, descrizione, procedimento, tempo, difficoltà, tags

### Componenti da creare
```
src/
├── pages/RecipeForm.tsx          # Pagina principale
├── components/Recipes/
│   ├── IngredientSearch.tsx      # Autocomplete con debounce
│   ├── IngredientList.tsx        # Lista ingredienti aggiunti
│   ├── NutritionSummary.tsx      # Riepilogo macro calcolati
│   └── TagInput.tsx              # Input per tags multipli
```

### Specifiche UI
```tsx
// Struttura ingrediente
interface IngredientInput {
  food_id: string
  food_name: string
  quantity_g: number
  // Calcolati dal food
  calories: number
  proteins_g: number
  carbs_g: number
  fats_g: number
}

// Form state
interface RecipeFormData {
  name: string
  description: string
  procedure: string
  preparation_time_min: number
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  ingredients: IngredientInput[]
}
```

### API utilizzate
- `GET /api/v1/foods?search=xxx` - Autocomplete
- `POST /api/v1/recipes` - Creazione
- `PUT /api/v1/recipes/:id` - Modifica
- `GET /api/v1/recipes/:id` - Carica dati per modifica

### Note implementazione
- Debounce 300ms su search ingredienti
- Validazione: almeno 1 ingrediente, nome obbligatorio
- Mostra preview nutrizionale mentre si aggiungono ingredienti
- Salva come draft in localStorage (opzionale)

---

## F2: Meal Form (Registrazione Pasto)

**Path**: `frontend/src/pages/MealForm.tsx`
**Complessità**: Media
**Dipendenze**: Nessuna

### Requisiti
- Due modalità: da ricetta esistente O pasto libero
- Se da ricetta: seleziona ricetta, imposta porzione
- Se libero: aggiungi ingredienti manualmente (come F1)
- Opzione "Salva come ricetta" per pasti liberi
- Selettore tipo pasto (colazione, spuntino, pranzo, cena)
- Data/ora consumazione

### Componenti da creare
```
src/
├── pages/MealForm.tsx            # Pagina principale
├── components/Meals/
│   ├── MealTypeSelector.tsx      # Bottoni tipo pasto
│   ├── RecipeSelector.tsx        # Dropdown ricette esistenti
│   ├── PortionInput.tsx          # Slider/input porzione
│   └── SaveAsRecipeToggle.tsx    # Checkbox salva come ricetta
```

### Specifiche UI
```tsx
type MealMode = 'from_recipe' | 'free_meal'

interface MealFormData {
  mode: MealMode
  // Se from_recipe
  recipe_id?: string
  portion_multiplier?: number  // 1 = porzione intera, 0.5 = mezza
  // Se free_meal
  ingredients?: IngredientInput[]
  save_as_recipe?: boolean
  recipe_name?: string  // Se save_as_recipe = true
  // Comuni
  meal_type: 'colazione' | 'spuntino' | 'pranzo' | 'cena'
  consumed_at: string  // ISO datetime
  notes?: string
}
```

### API utilizzate
- `GET /api/v1/recipes?house_id=xxx` - Lista ricette
- `POST /api/v1/meals` - Registra pasto
- `GET /api/v1/foods?search=xxx` - Autocomplete (se free_meal)

---

## F3: Recipe Detail View (Dettaglio Ricetta)

**Path**: `frontend/src/pages/RecipeDetail.tsx`
**Complessità**: Bassa
**Dipendenze**: Nessuna

### Requisiti
- Visualizza tutti i dettagli ricetta
- Lista ingredienti con quantità e nutrienti singoli
- Riepilogo nutrizionale totale
- Bottoni: Modifica, Elimina, "Prepara" (registra come pasto)
- Calcolo per N porzioni (slider)

### Componenti da creare
```
src/
├── pages/RecipeDetail.tsx        # Pagina principale
├── components/Recipes/
│   ├── RecipeHeader.tsx          # Nome, tempo, difficoltà, tags
│   ├── IngredientTable.tsx       # Tabella ingredienti
│   ├── NutritionCard.tsx         # Card macro/micro
│   ├── ProcedureSection.tsx      # Procedimento formattato
│   └── PortionCalculator.tsx     # Slider porzioni
```

### API utilizzate
- `GET /api/v1/recipes/:id` - Dettaglio ricetta
- `DELETE /api/v1/recipes/:id` - Elimina
- `POST /api/v1/meals` - "Prepara" → registra pasto

---

# BACKEND TASKS

## B1: Core Setup (Struttura Base)

**Path**: `backend/`
**Complessità**: Media
**Dipendenze**: Nessuna (PRIMO DA FARE)

### Requisiti
- Setup FastAPI con struttura cartelle
- Configurazione database PostgreSQL
- Models SQLAlchemy base
- Pydantic schemas base
- Middleware CORS
- Health check endpoint

### Files da creare
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py             # Settings da .env
│   │   ├── security.py           # Password hashing
│   │   └── constants.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py            # Database session
│   │   └── base.py               # Base model class
│   ├── models/
│   │   ├── __init__.py
│   │   └── base.py               # BaseModel con id, timestamps
│   ├── schemas/
│   │   └── __init__.py
│   └── middleware/
│       ├── __init__.py
│       └── cors.py
├── requirements.txt
├── Dockerfile
├── .env.example
└── alembic/                      # Migrations (opzionale)
```

### Contenuto main.py
```python
from fastapi import FastAPI
from app.middleware.cors import setup_cors
from app.db.session import engine
from app.models import Base

app = FastAPI(
    title="Meal Planner API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

setup_cors(app)

@app.on_event("startup")
async def startup():
    # Create tables
    Base.metadata.create_all(bind=engine)

@app.get("/health")
async def health():
    return {"status": "ok"}

# Import routers qui dopo
```

### Contenuto config.py
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    JWT_EXPIRATION: int = 3600
    REFRESH_TOKEN_EXPIRATION: int = 604800
    GROCY_URL: str = ""
    GROCY_API_KEY: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

### requirements.txt
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
psycopg2-binary==2.9.9
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.26.0
python-multipart==0.0.6
```

---

## B2: Authentication (Auth Endpoints)

**Path**: `backend/app/api/v1/auth.py`
**Complessità**: Media
**Dipendenze**: B1 (Core Setup)

### Requisiti
- POST /auth/register - Registrazione
- POST /auth/login - Login con JWT
- POST /auth/refresh - Refresh token
- Password hashing con bcrypt
- JWT access + refresh tokens

### Files da creare
```
backend/app/
├── models/
│   └── user.py                   # User model
├── schemas/
│   └── user.py                   # UserCreate, UserResponse, Token
├── services/
│   └── auth_service.py           # Business logic auth
├── api/
│   └── v1/
│       ├── __init__.py
│       ├── auth.py               # Endpoints
│       └── deps.py               # get_current_user dependency
```

### User Model
```python
from sqlalchemy import Column, String, JSON, DateTime
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    avatar_url = Column(String(255))
    preferences = Column(JSON, default={})
```

### Schemas
```python
from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    preferences: dict

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
```

### Endpoints
```python
@router.post("/register", response_model=Token)
async def register(data: UserCreate, db: Session = Depends(get_db)):
    # 1. Check email not exists
    # 2. Hash password
    # 3. Create user
    # 4. Create default house "Mia Casa"
    # 5. Return tokens

@router.post("/login", response_model=Token)
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    # 1. Find user by email
    # 2. Verify password
    # 3. Generate tokens
    # 4. Return tokens

@router.post("/refresh", response_model=Token)
async def refresh(refresh_token: str, db: Session = Depends(get_db)):
    # 1. Verify refresh token
    # 2. Generate new tokens
    # 3. Return tokens
```

---

## B3: Houses (Gestione Case + Inviti)

**Path**: `backend/app/api/v1/houses.py`
**Complessità**: Media
**Dipendenze**: B1, B2

### Requisiti
- CRUD houses
- Sistema membership (user_house)
- Generazione codici invito (6 char, scadenza 7 giorni)
- Join con codice
- Rimozione membri

### Files da creare
```
backend/app/
├── models/
│   ├── house.py                  # House model
│   ├── user_house.py             # Membership model
│   └── house_invite.py           # Invite model
├── schemas/
│   └── house.py                  # HouseCreate, HouseResponse, etc
├── services/
│   └── house_service.py          # Business logic
├── api/v1/
│   └── houses.py                 # Endpoints
```

### Models
```python
# house.py
class House(BaseModel):
    __tablename__ = "houses"
    owner_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    location = Column(String(255))
    settings = Column(JSON, default={})

# user_house.py
class UserHouse(Base):
    __tablename__ = "user_house"
    user_id = Column(UUID, ForeignKey("users.id"), primary_key=True)
    house_id = Column(UUID, ForeignKey("houses.id"), primary_key=True)
    role = Column(String(50), default="MEMBER")  # OWNER, MEMBER, GUEST
    joined_at = Column(DateTime, default=func.now())

# house_invite.py
class HouseInvite(BaseModel):
    __tablename__ = "house_invites"
    house_id = Column(UUID, ForeignKey("houses.id"), nullable=False)
    code = Column(String(6), unique=True, nullable=False)
    created_by = Column(UUID, ForeignKey("users.id"), nullable=False)
    used_by = Column(UUID, ForeignKey("users.id"))
    expires_at = Column(DateTime, nullable=False)
```

### Endpoints
```
POST   /houses              - Crea casa (user diventa OWNER)
GET    /houses              - Lista case dell'utente
GET    /houses/{id}         - Dettaglio casa con membri
PUT    /houses/{id}         - Modifica (solo owner)
DELETE /houses/{id}         - Elimina (solo owner)
POST   /houses/{id}/invites - Genera codice invito
POST   /houses/join         - Unisciti con codice
DELETE /houses/{id}/members/{user_id} - Rimuovi membro
```

---

## B4: Recipes + Meals

**Path**: `backend/app/api/v1/recipes.py`, `meals.py`
**Complessità**: Media-Alta
**Dipendenze**: B1, B2, B3

### Requisiti Recipes
- CRUD ricette per casa
- Ingredienti in JSONB
- Calcolo automatico nutrienti da foods
- Filtri per tags, difficoltà

### Requisiti Meals
- Registrazione pasto (da ricetta o libero)
- Query per data range
- Calcolo nutrienti

### Files da creare
```
backend/app/
├── models/
│   ├── recipe.py
│   └── meal.py
├── schemas/
│   ├── recipe.py
│   └── meal.py
├── services/
│   ├── recipe_service.py         # Include calcolo nutrienti
│   ├── meal_service.py
│   └── nutrition.py              # Logica calcoli
├── api/v1/
│   ├── recipes.py
│   └── meals.py
```

### Recipe Model
```python
class Recipe(BaseModel):
    __tablename__ = "recipes"
    house_id = Column(UUID, ForeignKey("houses.id"), nullable=False)
    created_by = Column(UUID, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    procedure = Column(Text)
    ingredients = Column(JSONB, nullable=False)  # [{food_id, quantity_g, food_name}]
    preparation_time_min = Column(Integer)
    difficulty = Column(String(50))
    tags = Column(JSONB, default=[])
    # Calcolati
    total_calories = Column(Numeric(10, 2))
    total_proteins_g = Column(Numeric(10, 2))
    total_fats_g = Column(Numeric(10, 2))
    total_carbs_g = Column(Numeric(10, 2))
```

### Meal Model
```python
class Meal(BaseModel):
    __tablename__ = "meals"
    user_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    house_id = Column(UUID, ForeignKey("houses.id"), nullable=False)
    recipe_id = Column(UUID, ForeignKey("recipes.id"))  # NULL se libero
    meal_type = Column(String(50))  # colazione, spuntino, pranzo, cena
    ingredients = Column(JSONB)  # Se pasto libero
    quantity_grams = Column(Numeric(10, 2))
    calories = Column(Numeric(10, 2))
    proteins_g = Column(Numeric(10, 2))
    fats_g = Column(Numeric(10, 2))
    carbs_g = Column(Numeric(10, 2))
    consumed_at = Column(DateTime, nullable=False)
    notes = Column(Text)
```

### Calcolo Nutrienti (nutrition.py)
```python
def calculate_recipe_nutrition(ingredients: list, foods_db: dict) -> dict:
    """
    ingredients: [{food_id, quantity_g}]
    foods_db: {food_id: Food}
    returns: {calories, proteins_g, fats_g, carbs_g, ...}
    """
    totals = defaultdict(float)
    for ing in ingredients:
        food = foods_db.get(ing['food_id'])
        if not food:
            continue
        ratio = ing['quantity_g'] / 100  # DB ha valori per 100g
        totals['calories'] += (food.calories or 0) * ratio
        totals['proteins_g'] += food.proteins_g * ratio
        # ... altri nutrienti
    return dict(totals)
```

---

## B5: Foods + Health

**Path**: `backend/app/api/v1/foods.py`, `health.py`
**Complessità**: Bassa-Media
**Dipendenze**: B1

### Requisiti Foods
- Import CSV nutrizione al startup/seed
- Search alimenti con fuzzy match
- Filtro per categoria
- GET singolo alimento

### Requisiti Health
- CRUD peso (weights)
- CRUD health records
- Query per user e date range

### Files da creare
```
backend/app/
├── models/
│   ├── food.py
│   ├── weight.py
│   └── health_record.py
├── schemas/
│   ├── food.py
│   └── health.py
├── services/
│   └── health_service.py
├── api/v1/
│   ├── foods.py
│   └── health.py
├── db/
│   └── seed.py                   # Import CSV
```

### Food Model
```python
class Food(BaseModel):
    __tablename__ = "foods"
    name = Column(String(255), unique=True, nullable=False, index=True)
    category = Column(String(100), index=True)
    # Macro (per 100g)
    calories = Column(Numeric(8, 2))
    proteins_g = Column(Numeric(8, 2))
    fats_g = Column(Numeric(8, 2))
    carbs_g = Column(Numeric(8, 2))
    fibers_g = Column(Numeric(8, 2))
    # ... altri nutrienti dal CSV
```

### Seed Script (seed.py)
```python
import csv
from app.models.food import Food

def seed_foods(db: Session, csv_path: str):
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            food = Food(
                name=row['Alimento'],
                category=row['Categoria'],
                proteins_g=float(row['Proteine (g)'] or 0),
                # ... mapping colonne
            )
            db.add(food)
    db.commit()
```

### Foods Endpoints
```
GET /foods?search=xxx&category=xxx&limit=50
GET /foods/{id}
GET /foods/categories
```

---

## B6: Grocy Integration

**Path**: `backend/app/integrations/grocy.py`
**Complessità**: Media
**Dipendenze**: B1

### Requisiti
- Client HTTP per Grocy API
- Proxy endpoints per stock e prodotti
- Caching opzionale
- Gestione errori connessione

### Files da creare
```
backend/app/
├── integrations/
│   ├── __init__.py
│   └── grocy.py                  # HTTP client
├── schemas/
│   └── grocy.py
├── api/v1/
│   └── grocy.py                  # Proxy endpoints
```

### Grocy Client
```python
import httpx
from app.core.config import settings

class GrocyClient:
    def __init__(self):
        self.base_url = settings.GROCY_URL
        self.api_key = settings.GROCY_API_KEY
        self.headers = {
            "GROCY-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }

    async def get_stock(self) -> list:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/stock",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_products(self) -> list:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/objects/products",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

grocy_client = GrocyClient()
```

### Endpoints
```
GET /grocy/stock     - Lista stock con quantità
GET /grocy/products  - Lista prodotti
GET /grocy/products/{id}
```

---

# INFRA TASK

## I1: Docker Compose + Scripts

**Path**: `docker-compose.yml`, `scripts/`
**Complessità**: Bassa
**Dipendenze**: Nessuna (può partire in parallelo)

### Files da creare
```
meal-planner/
├── docker-compose.yml
├── docker-compose.dev.yml        # Override per dev
├── .env.example
└── scripts/
    ├── setup_dev.sh              # Setup ambiente dev
    ├── import_foods.py           # Import CSV standalone
    └── backup_db.sh              # Backup PostgreSQL
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: meal_planner
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: meal_planner_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - meal-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meal_planner"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://meal_planner:${DB_PASSWORD}@postgres:5432/meal_planner_db
      SECRET_KEY: ${SECRET_KEY}
      GROCY_URL: ${GROCY_URL}
      GROCY_API_KEY: ${GROCY_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - meal-network

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - meal-network

volumes:
  postgres_data:

networks:
  meal-network:
    driver: bridge
```

### .env.example
```
# Database
DB_PASSWORD=your-secure-password

# Backend
SECRET_KEY=your-super-secret-key-change-in-production
JWT_EXPIRATION=3600
REFRESH_TOKEN_EXPIRATION=604800

# Grocy
GROCY_URL=http://your-grocy-instance:port
GROCY_API_KEY=your-grocy-api-key

# MQTT (optional)
MQTT_BROKER=
MQTT_PORT=1883
MQTT_USER=
MQTT_PASSWORD=
```

---

# ASSEGNAZIONE CONSIGLIATA

## Fase 1 (Parallelo - 4 agent)
| Agent | Task | Tempo stimato |
|-------|------|---------------|
| Agent 1 | B1: Core Setup | 15 min |
| Agent 2 | I1: Docker Compose | 10 min |
| Agent 3 | F1: Recipe Form | 20 min |
| Agent 4 | F2: Meal Form | 15 min |

## Fase 2 (Parallelo - 4 agent, dopo B1)
| Agent | Task | Tempo stimato |
|-------|------|---------------|
| Agent 1 | B2: Auth | 15 min |
| Agent 2 | B3: Houses | 15 min |
| Agent 3 | B5: Foods + Health | 15 min |
| Agent 4 | F3: Recipe Detail | 10 min |

## Fase 3 (Parallelo - 2 agent, dopo B2+B3+B5)
| Agent | Task | Tempo stimato |
|-------|------|---------------|
| Agent 1 | B4: Recipes + Meals | 20 min |
| Agent 2 | B6: Grocy Integration | 15 min |

---

# NOTE PER GLI AGENT

1. **Riferimenti**: Usare `SPEC.md` per dettagli completi su schema DB e API
2. **Types**: I tipi TypeScript sono già definiti in `frontend/src/types/index.ts`
3. **Services**: I service API frontend sono già in `frontend/src/services/`
4. **Stile**: Usare le classi Tailwind già definite (btn, input, card, label)
5. **CSV Nutrienti**: File in `../nutrizione_pulito.csv` con 192 alimenti
6. **Test**: Ogni task dovrebbe includere almeno test base

---

*Documento generato: 2026-01-13*
