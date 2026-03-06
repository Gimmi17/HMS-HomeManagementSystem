# Meal Planner - Specifica Completa

**Data**: 2026-01-13  
**Versione**: 1.0 - MVP  
**Status**: Planning

---

## **1. Panoramica Progetto**

### Visione
Sistema di meal planning intelligente e multi-utente che suggerisce ricette basandosi su:
- Prodotti disponibili in casa (Grocy)
- Valori nutrizionali degli alimenti (DB locale: 192 alimenti)
- Contesto giornaliero (meteo da Home Assistant)
- Preferenze e storico dell'utente

### Funzionalità MVP
- ✅ Autenticazione multi-utente per casa
- ✅ Creazione e gestione ricette
- ✅ Registrazione pasti consumati
- ✅ Tracking peso e salute personale
- ✅ Lettura inventario da Grocy
- ✅ Calcolo automatico nutrizionale
- ✅ Sistema di inviti per aggiungere utenti a una casa

### Futuro (Phase 2+)
- 🔮 Suggerimenti intelligenti basati su inventario (con LLM locale)
- 🔮 Piano settimanale automatico
- 🔮 Notifiche Telegram
- 🔮 Automazioni n8n (reminder, export, alerta scadenze)
- 🔮 Widget in Home Assistant
- 🔮 ML per preferenze personali

---

## **2. Ecosistema Disponibile**

```
Infrastruttura Self-Hosted su NAS (Docker):
├─ Home Assistant (Grocy, meteo, MQTT)
├─ OpenWebUI (LLM locali)
├─ n8n (automazioni)
└─ Docker Compose (orchestrazione)
```

**Integrazioni Richieste**:
- Grocy API (inventario)
- Home Assistant MQTT
- OpenWebUI (futura)
- n8n (futura)

---

## **3. Tech Stack - Scelta Definitiva**

### Frontend
```
Framework: React 18+ con TypeScript
Build Tool: Vite
State Management: React Context + custom hooks
HTTP Client: Axios
Styling: CSS Modules / Tailwind (da decidere)
Deploy: Container Docker separato
URL: Sito dedicato (not in HASS)
Port: 3000
```

**Perché React?**
- Ecosystem maturo
- TypeScript per robustezza
- Facile integrazione widget HA (futura)
- Performance eccellente per UI complessa

### Backend
```
Framework: Python 3.11+ con FastAPI
ORM: SQLAlchemy 2.0
Validazione: Pydantic v2
Database: PostgreSQL 14+
Cache: Redis (opzionale, Fase 2)
Authentication: JWT (access + refresh tokens)
Testing: pytest + pytest-asyncio
Docs Auto: Swagger/OpenAPI
Deploy: Container Docker
Port: 8000
```

**Perché Python + FastAPI?**
- Type hints nati (Pydantic)
- Async nativo + performance
- MQTT support triviale (paho-mqtt)
- LLM integration semplice (ollama, llama.cpp, LangChain)
- Scripting rapido per feature future
- Custom HA integration in Python
- SQLAlchemy = schemi ultra-flessibili
- API auto-documentation (Swagger)
- Comunità italiana buona

### Database
```
Sistema: PostgreSQL 14+
Container: docker-compose
Port: 5432 (internal only)
User: meal_planner
Password: (env)
Database: meal_planner_db

Tipologie colonne usate:
- UUID (primary keys)
- VARCHAR, TEXT
- DECIMAL (nutrienti)
- TIMESTAMP (audit)
- JSONB (ingredienti, tags - massima flessibilità)
- ARRAY (futura)
```

**Perché PostgreSQL?**
- JSONB = schemi dinamici (ingredienti formula)
- Multi-utente nativo
- Transazioni robuste
- Self-hosted, nessun vendor lock
- Future full-text search, sharding

### Real-time & Integrazioni
```
MQTT: Home Assistant native
  → Backend pubblica su topic MQTT
  → HA legge e mostra widget (futura)
  → n8n può subscribere (futura)

REST API: Standard per integrazioni future

Custom Integration HA: (Phase 2, opzionale)
  → Python manifest.json + componente
  → Display UI nel front-end HA
```

---

## **4. Architettura Sistema**

### Diagramma Completo

```
┌─────────────────────────────────────────────────────────┐
│         FRONTEND (React + TypeScript)                    │
│  Dashboard | Ricette | Pasti | Profilo | Gestione Casa │
│  Deployed: http://nas:3000                              │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS/HTTP REST API
          ┌───────────▼──────────────────┐
          │  Backend (FastAPI - Python)  │
          │  Deployed: http://nas:8000   │
          │                              │
          │ Features:                    │
          │ ✓ Auth (JWT)                 │
          │ ✓ Multi-user / Multi-house   │
          │ ✓ Ricette CRUD               │
          │ ✓ Pasti tracking             │
          │ ✓ Calcolo nutrizionale       │
          │ ✓ Grocy API proxy            │
          │ ✓ MQTT publisher             │
          └──┬────────┬──────────┬───┬──┘
             │        │          │   │
    ┌────────▼──┐ ┌──▼──┐ ┌──────▼┐ │
    │PostgreSQL │ │MQTT │ │Grocy  │ │
    │ Database  │ │(HA) │ │API    │ │
    │ Multi-    │ └──┬──┘ └───────┘ │
    │ tenant    │    │               │
    └───────────┘    │               │
                     │ (Optional widget)
              ┌──────▼────────┐
              │Home Assistant │
              │Widgets/Logic  │
              └───────────────┘

┌──────────────────────────────────────┐
│ Future Integrations (Phase 2+)      │
├──────────────────────────────────────┤
│ ✓ OpenWebUI (LLM suggerimenti)      │
│ ✓ n8n (automazioni, notifiche)      │
│ ✓ Telegram Bot (notifiche)          │
└──────────────────────────────────────┘
```

---

## **5. Struttura Progetto Git**

```
hms/
│
├── README.md                          # Intro + setup veloce
├── ARCHITECTURE.md                    # Questo documento
├── docker-compose.yml                 # Orchestrazione completa
├── .env.example                       # Template variabili ambiente
├── .gitignore
│
├── frontend/                          # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/                  # Login, Register
│   │   │   ├── Dashboard/             # Home page
│   │   │   ├── Recipes/               # CRUD ricette
│   │   │   ├── Meals/                 # Registra pasti
│   │   │   ├── Health/                # Peso, salute
│   │   │   ├── Houses/                # Gestione casa, inviti
│   │   │   ├── Grocy/                 # Visualizza inventario
│   │   │   └── Layout/                # Header, Sidebar, Footer
│   │   ├── pages/
│   │   ├── hooks/
│   │   │   ├── useAuth.ts             # Auth context hook
│   │   │   ├── useHouse.ts            # House context hook
│   │   │   └── useApi.ts              # Wrapper Axios
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── HouseContext.tsx
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── api.ts                 # Axios instance + config
│   │   │   ├── auth.ts                # Auth API calls
│   │   │   ├── recipes.ts             # Recipe API calls
│   │   │   ├── meals.ts               # Meals API calls
│   │   │   └── grocy.ts               # Grocy proxy calls
│   │   ├── types/
│   │   │   ├── index.ts               # Definizioni TypeScript
│   │   │   ├── user.ts
│   │   │   ├── recipe.ts
│   │   │   ├── meal.ts
│   │   │   └── grocy.ts
│   │   ├── utils/
│   │   │   ├── constants.ts
│   │   │   ├── validators.ts
│   │   │   └── formatters.ts
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── vite-env.d.ts
│   ├── public/
│   ├── index.html
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── README.md
│
├── backend/                           # FastAPI Python
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py            # POST /register, /login
│   │   │       ├── users.py           # GET /me, PUT /profile
│   │   │       ├── houses.py          # GET/POST /houses, inviti
│   │   │       ├── recipes.py         # CRUD /recipes
│   │   │       ├── meals.py           # CRUD /meals
│   │   │       ├── health.py          # CRUD /weights, /health
│   │   │       ├── grocy.py           # GET /grocy/stock, /products
│   │   │       └── deps.py            # Dipendenze comuni (auth, db)
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── house.py
│   │   │   ├── recipe.py
│   │   │   ├── meal.py
│   │   │   ├── food.py                # DB nutrienti da CSV
│   │   │   ├── weight.py
│   │   │   ├── health.py
│   │   │   ├── house_invite.py
│   │   │   └── base.py                # Base model con ID, timestamps
│   │   │
│   │   ├── schemas/                   # Pydantic request/response
│   │   │   ├── __init__.py
│   │   │   ├── user.py                # UserCreate, UserResponse, etc
│   │   │   ├── recipe.py              # RecipeCreate, RecipeResponse
│   │   │   ├── meal.py                # MealCreate, MealResponse
│   │   │   ├── health.py
│   │   │   └── grocy.py               # GrocyStockResponse
│   │   │
│   │   ├── services/                  # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py        # JWT, password hashing
│   │   │   ├── user_service.py
│   │   │   ├── house_service.py       # Membership, inviti
│   │   │   ├── recipe_service.py      # Calcolo nutrizionale
│   │   │   ├── meal_service.py
│   │   │   ├── nutrition.py           # Logica calcoli nutrizionali
│   │   │   ├── suggestion.py          # (Futura) Suggerimenti ricette
│   │   │   └── grocy_service.py       # Client Grocy
│   │   │
│   │   ├── integrations/              # External services
│   │   │   ├── __init__.py
│   │   │   ├── grocy.py               # Grocy HTTP client
│   │   │   ├── mqtt.py                # MQTT publisher
│   │   │   ├── homeassistant.py       # HA client (futura)
│   │   │   └── llm.py                 # LLM client (futura)
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py             # Database session factory
│   │   │   ├── base.py                # Base ORM class
│   │   │   └── seed.py                # Script import CSV nutrienti
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py              # Settings da .env
│   │   │   ├── security.py            # JWT, password
│   │   │   └── constants.py
│   │   │
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   └── cors.py                # CORS setup
│   │   │
│   │   └── main.py                    # FastAPI app + routes
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py                # pytest fixtures
│   │   ├── test_auth.py
│   │   ├── test_recipes.py
│   │   ├── test_meals.py
│   │   └── test_grocy.py
│   │
│   ├── data/
│   │   └── nutrizione_pulito.csv      # DB nutrienti (192 alimenti)
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── README.md
│   └── alembic/                       # Database migrations (opzionale)
│
├── hass-integration/                  # (Phase 2, opzionale)
│   └── custom_components/
│       └── meal_planner/
│           ├── __init__.py
│           ├── manifest.json
│           ├── config_flow.py
│           └── const.py
│
├── docs/
│   ├── ARCHITECTURE.md                # Questo file
│   ├── API.md                         # Documentazione API endpoints
│   ├── DATABASE.md                    # Schema DB dettagliato
│   ├── SETUP.md                       # Installazione e config
│   ├── FLUSSI_UTENTE.md              # Use cases dettagliati
│   └── INTEGRAZIONI.md               # Grocy, HASS, MQTT
│
└── scripts/
    ├── setup_dev.sh                   # Setup environment locale
    ├── import_foods.py                # Import CSV → PostgreSQL
    └── generate_api_docs.sh           # Gen. Swagger docs
```

---

## **6. Schema Database Completo**

### Tabelle Principali

#### `users`
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(255),
    preferences JSONB DEFAULT '{}',  -- Allergies, dietary, goals, etc
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP
);
```

#### `houses`
```sql
CREATE TABLE houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    settings JSONB DEFAULT '{}',  -- Notification prefs, etc
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `user_house` (Membership)
```sql
CREATE TABLE user_house (
    user_id UUID NOT NULL REFERENCES users(id),
    house_id UUID NOT NULL REFERENCES houses(id),
    role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',  -- OWNER, MEMBER, GUEST
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, house_id)
);
```

#### `house_invites` (Inviti con codice)
```sql
CREATE TABLE house_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id UUID NOT NULL REFERENCES houses(id),
    code VARCHAR(6) UNIQUE NOT NULL,  -- "ABC123"
    created_by UUID NOT NULL REFERENCES users(id),
    used_by UUID REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### `foods` (Nutrienti - importati da CSV)
```sql
CREATE TABLE foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(100),  -- carne, frutta, verdura, etc
    
    -- Macronutrienti (per 100g)
    calories DECIMAL(8,2),
    proteins_g DECIMAL(8,2),
    fats_g DECIMAL(8,2),
    carbs_g DECIMAL(8,2),
    fibers_g DECIMAL(8,2),
    omega3_ala_g DECIMAL(8,4),
    omega6_g DECIMAL(8,4),
    
    -- Minerali
    calcium_mg DECIMAL(8,2),
    iron_mg DECIMAL(8,2),
    magnesium_mg DECIMAL(8,2),
    potassium_mg DECIMAL(8,2),
    zinc_mg DECIMAL(8,2),
    
    -- Vitamine
    vitamin_a_mcg DECIMAL(8,2),
    vitamin_c_mg DECIMAL(8,2),
    vitamin_d_mcg DECIMAL(8,2),
    vitamin_e_mg DECIMAL(8,2),
    vitamin_k_mcg DECIMAL(8,2),
    vitamin_b6_mg DECIMAL(8,2),
    folate_b9_mcg DECIMAL(8,2),
    vitamin_b12_mcg DECIMAL(8,2),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indici performance
CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_category ON foods(category);
```

#### `recipes`
```sql
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id UUID NOT NULL REFERENCES houses(id),
    created_by UUID NOT NULL REFERENCES users(id),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    procedure TEXT,
    
    -- Ingredienti: JSON flessibile
    -- Esempio:
    -- [
    --   {"food_id": "uuid", "quantity_g": 200, "food_name": "Pollo"},
    --   {"food_id": "uuid", "quantity_g": 100, "food_name": "Pasta"}
    -- ]
    ingredients JSONB NOT NULL,
    
    preparation_time_min INTEGER,  -- minuti
    difficulty VARCHAR(50),  -- easy, medium, hard
    tags JSONB DEFAULT '[]',  -- ["veloce", "leggero", "comfort", "vegetariano"]
    
    -- Calcolati automaticamente
    total_calories DECIMAL(10,2),
    total_proteins_g DECIMAL(10,2),
    total_fats_g DECIMAL(10,2),
    total_carbs_g DECIMAL(10,2),
    
    is_public BOOLEAN DEFAULT FALSE,  -- Condivisibile con altre case (futura)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recipes_house ON recipes(house_id);
```

#### `meals` (Pasti consumati)
```sql
CREATE TABLE meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    house_id UUID NOT NULL REFERENCES houses(id),
    recipe_id UUID REFERENCES recipes(id),  -- NULL se pasto ad-hoc
    
    meal_type VARCHAR(50),  -- colazione, spuntino, pranzo, cena
    
    -- Ingredienti se non da ricetta (JSON)
    ingredients JSONB,
    
    quantity_grams DECIMAL(10,2),  -- Quantità mangiata (se diversa da ricetta)
    
    -- Nutrienti calcolati al momento
    calories DECIMAL(10,2),
    proteins_g DECIMAL(10,2),
    fats_g DECIMAL(10,2),
    carbs_g DECIMAL(10,2),
    
    consumed_at TIMESTAMP NOT NULL,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_meals_user_date ON meals(user_id, consumed_at);
CREATE INDEX idx_meals_house ON meals(house_id);
```

#### `weights` (Tracking peso)
```sql
CREATE TABLE weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    house_id UUID NOT NULL REFERENCES houses(id),
    
    weight_kg DECIMAL(6,2) NOT NULL,
    measured_at TIMESTAMP NOT NULL,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_weights_user_date ON weights(user_id, measured_at);
```

#### `health_records` (Salute)
```sql
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    house_id UUID NOT NULL REFERENCES houses(id),
    
    type VARCHAR(100),  -- cold, flu, headache, allergy, injury, other
    description TEXT NOT NULL,
    severity VARCHAR(50),  -- mild, moderate, severe
    recorded_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_user_date ON health_records(user_id, recorded_at);
```

---

## **7. API Endpoints - Skeleton**

Tutti gli endpoint richiedono JWT nel header: `Authorization: Bearer <token>`

### Authentication (No Auth Required)
```
POST   /api/v1/auth/register
       Body: { email, password, full_name }
       Response: { user_id, email, token, refresh_token }

POST   /api/v1/auth/login
       Body: { email, password }
       Response: { user_id, email, token, refresh_token }

POST   /api/v1/auth/refresh
       Body: { refresh_token }
       Response: { token, refresh_token }
```

### Users
```
GET    /api/v1/users/me
       Response: { id, email, full_name, preferences, houses: [] }

PUT    /api/v1/users/me
       Body: { full_name, preferences, avatar_url }

PUT    /api/v1/users/me/password
       Body: { current_password, new_password }
```

### Houses
```
POST   /api/v1/houses
       Body: { name, description, location }
       Response: { id, name, owner_id, members: [] }

GET    /api/v1/houses
       Response: [{ id, name, owner_id, members: [] }]

GET    /api/v1/houses/{house_id}
       Response: { id, name, owner_id, members: [{user_id, role, joined_at}] }

PUT    /api/v1/houses/{house_id}
       Body: { name, description, location, settings }

DELETE /api/v1/houses/{house_id}
       (Solo owner)

POST   /api/v1/houses/{house_id}/invites
       Body: {}
       Response: { code, expires_at }

POST   /api/v1/houses/join
       Body: { invite_code }
       Response: { house_id, name, members: [] }

DELETE /api/v1/houses/{house_id}/members/{user_id}
       (Solo owner)
```

### Recipes
```
POST   /api/v1/recipes
       Body: { name, description, ingredients: [{food_id, quantity_g}], 
               preparation_time_min, difficulty, tags, procedure }
       Response: { id, name, total_calories, total_proteins_g, ... }

GET    /api/v1/recipes?house_id={house_id}
       Response: [{ id, name, total_calories, difficulty, tags }]

GET    /api/v1/recipes/{recipe_id}
       Response: { id, name, ingredients: [{ food_name, quantity_g, calories }], ... }

PUT    /api/v1/recipes/{recipe_id}
       Body: { same as POST }

DELETE /api/v1/recipes/{recipe_id}
```

### Meals
```
POST   /api/v1/meals
       Body: { recipe_id OR ingredients: [{food_id, quantity_g}], 
               meal_type, consumed_at, quantity_grams, notes }
       Response: { id, calories, proteins_g, consumed_at }

GET    /api/v1/meals?house_id={house_id}&from={date}&to={date}
       Response: [{ id, user_id, recipe_name, calories, consumed_at }]

GET    /api/v1/meals/{meal_id}
       Response: { id, user_id, ingredients: [], calories, macros, ... }

DELETE /api/v1/meals/{meal_id}
       (Solo creatore o house owner)
```

### Health - Weights
```
POST   /api/v1/weights
       Body: { weight_kg, measured_at, notes }
       Response: { id, weight_kg, measured_at }

GET    /api/v1/weights?house_id={house_id}&user_id={user_id}
       Response: [{ id, weight_kg, measured_at }]

DELETE /api/v1/weights/{weight_id}
```

### Health - Records
```
POST   /api/v1/health
       Body: { type, description, severity, recorded_at }
       Response: { id, type, description, recorded_at }

GET    /api/v1/health?house_id={house_id}
       Response: [{ id, user_id, type, description, recorded_at }]

DELETE /api/v1/health/{record_id}
```

### Grocy Integration (Proxy)
```
GET    /api/v1/grocy/stock
       Response: [{ product_id, product_name, quantity, unit }]

GET    /api/v1/grocy/products
       Response: [{ id, name, ean, brand, weight_g, cost }]

GET    /api/v1/grocy/products/{product_id}
       Response: { id, name, ean, brand, weight_g, cost }

# Futura: match prodotto Grocy → alimento DB
POST   /api/v1/grocy/match-food
       Body: { grocy_product_id, food_id }
       Response: { matched: true }
```

### Foods (DB Nutrienti)
```
GET    /api/v1/foods
       Query: ?search=pollo&category=carne&limit=50
       Response: [{ id, name, calories, proteins_g, ... }]

GET    /api/v1/foods/{food_id}
       Response: { id, name, category, calories, macro, micro, vitamine }
```

---

## **8. Flussi Utente Principali**

### Flusso 1: "Mi registro e creo la mia casa"
```
1. Utente → Pagina Register
2. Inserisce: email, password, nome
3. Clicca "Registrati"
4. Backend:
   - Hash password
   - Crea user
   - Crea house predefinita "Mia Casa"
   - Aggiunge user come OWNER
   - Genera JWT
5. Frontend:
   - Salva token in localStorage
   - Redirect a /dashboard
```

### Flusso 2: "Invito un altro utente"
```
1. Utente A (owner) → /dashboard → Sezione "Gestisci Casa"
2. Clicca "Invita Membro"
3. Backend:
   - Genera codice 6 char (ABC123)
   - Crea record house_invites
   - TTL 7 giorni
   - Ritorna codice
4. A condivide codice (Telegram, WhatsApp, etc)
5. Utente B:
   - Si registra → nuovo account
   - Va su /join-house
   - Inserisce ABL123
   - Backend: valida, aggiunge a casa
   - B vede la casa in /dashboard
```

### Flusso 3: "Creo una ricetta"
```
1. Utente → /recipes → "Nuova Ricetta"
2. Form:
   - Nome: "Pasta al Pomodoro"
   - Ingredienti:
     * Pasta: 100g
     * Pomodori: 200g
     * Olio: 20g
   - Tempo: 20 min
   - Difficoltà: facile
   - Tag: ["veloce", "vegetariano"]
3. Clicca "Salva"
4. Backend:
   - Valida ingredienti (devono esistere in DB foods)
   - Calcola nutrienti per 100g ingredienti
   - Salva recipe
   - Ritorna {id, name, calories, proteins_g, ...}
5. Ricetta disponibile per pasti futuri
```

### Flusso 4: "Registro un pasto consumato"
```
Opzione A: Da ricetta
1. Utente → /meals → "Nuovo Pasto"
2. Seleziona ricetta dalla lista
3. Seleziona quantità (default 1 porzione)
4. Inserisce meal_type (pranzo, cena, etc)
5. Clicca "Salva"
6. Backend: crea meal record con nutrienti calcolati

Opzione B: Ad-hoc (non da ricetta)
1. Utente → /meals → "Pasto Libero"
2. Inserisce ingredienti manualmente:
   - Pollo: 150g
   - Riso: 80g
3. Clicca "Salva"
4. Backend: calcola nutrienti dai food e salva meal
5. Bonus: Utente può dire "Salva come ricetta"
```

### Flusso 5: "Vedo l'inventario Grocy"
```
1. Utente → /pantry
2. Backend:
   - Chiama Grocy API: GET /api/stock
   - Ritorna lista prodotti con quantità
3. Frontend mostra:
   - Prodotto | Quantità | Unità | Scadenza
   - Evidenzia in rosso se scadenza < 3 giorni
4. Utente vede cosa ha in casa per suggerimenti ricette
```

### Flusso 6: "Tracking peso giornaliero"
```
1. Utente → /health → "Registra Peso"
2. Inserisce:
   - Peso: 75.5 kg
   - Data: 2025-01-13
   - Note: "dopo allenamento"
3. Clicca "Salva"
4. Backend: crea weight record
5. Dashboard mostra grafico peso (storico)
```

---

## **9. Requisiti Infrastruttura**

### Docker Compose Setup
```yaml
# Services:
- PostgreSQL 14 (5432)
- Backend FastAPI (8000)
- Frontend React (3000)
- Redis (6379) - opzionale, per caching
```

### Environment Variables Backend
```
DATABASE_URL=postgresql://user:pass@postgres:5432/meal_planner_db
SECRET_KEY=your-super-secret-key-here
JWT_EXPIRATION=3600  # secondi
REFRESH_TOKEN_EXPIRATION=604800  # 7 giorni

GROCY_URL=http://grocy-instance:port
GROCY_API_KEY=your-grocy-api-key

MQTT_BROKER=home-assistant-mqtt
MQTT_PORT=1883
MQTT_USER=user
MQTT_PASSWORD=pass

# Opzionale (Fase 2)
OPENWEBUI_URL=http://openwebui:8080
TELEGRAM_BOT_TOKEN=xxx
N8N_URL=http://n8n:5678
```

### Environment Variables Frontend
```
VITE_API_URL=http://nas:8000/api/v1
VITE_APP_NAME=Meal Planner
```

---

## **10. Validazioni & Regole Business**

### Auth
- Email deve essere valida e unica
- Password minimo 8 caratteri
- JWT expires in 1 hour
- Refresh token expires in 7 days

### Houses
- Un utente può avere N case
- Ogni casa ha 1 OWNER (min)
- Gli altri sono MEMBER o GUEST
- Inviti scadono in 7 giorni

### Recipes
- Nome unico per house
- Minimo 1 ingrediente
- Ingredienti devono esistere in DB foods
- Nutrienti calcolati automaticamente da ingredienti

### Meals
- Devono avere user_id + house_id + consumed_at
- Se da ricetta: riusa nutrienti ricetta
- Se ad-hoc: calcola da ingredienti

### Foods
- Importati da CSV una volta
- Non modificabili (read-only)
- Searchable per autocomplete

---

## **11. Testing Strategy**

### Unit Tests
```
- Test calcoli nutrizionali
- Test validazioni Pydantic
- Test JWT expiration
```

### Integration Tests
```
- Test flow registrazione
- Test Grocy API integration
- Test invitation flow
```

### E2E Tests (Futura)
```
- Selenium/Playwright tests
- Full user journey
```

---

## **12. Logging & Monitoring (Futura)**

```
- Request logging (FastAPI)
- Error tracking (Sentry)
- Prometheus metrics (opzionale)
- Grocy API call logging
```

---

## **13. Roadmap Temporale**

### Phase 1: MVP (Settimane 1-4)
- ✅ Setup infra + DB
- ✅ Auth (login/register/invite)
- ✅ CRUD ricette
- ✅ Registra pasti
- ✅ Leggere Grocy (read-only)
- ✅ Calcolo nutrizionale base
- ✅ Tracking peso

### Phase 2: Features (Settimane 5-8)
- 🔮 Suggerimenti intelligenti (Grocy match)
- 🔮 MQTT publisher (HA integration)
- 🔮 Notifiche Telegram
- 🔮 Health records (salute)
- 🔮 Storico pasti per utente
- 🔮 Grafico tracking peso

### Phase 3: AI & Automazioni (Settimane 9+)
- 🔮 LLM integration (OpenWebUI)
- 🔮 Piano settimanale automatico
- 🔮 n8n automazioni
- 🔮 Custom HA integration
- 🔮 Export PDF ricette
- 🔮 Sharing ricette tra case

### Phase 4: Scalabilità
- 🔮 Caching Redis
- 🔮 WebSocket real-time
- 🔮 Mobile app (React Native)

---

## **14. Informazioni Mancanti - Da Fornire**

Per procedere con l'implementazione, il programmatore avrà bisogno di:

```
1. GROCY:
   - URL completo: _______________
   - API Key: _______________
   - Port: _______________
   - Versione: _______________

2. HOME ASSISTANT:
   - URL: _______________
   - Port: _______________
   - MQTT Broker interno? SI/NO
   - MQTT Port: _______________
   - MQTT User/Pass: _______________

3. DATABASE NUTRIENTI (CSV):
   - File path: _______________
   - Colonne esatte (prima riga): _______________
   - Encoding: UTF-8? _______________

4. DOCKER:
   - NAS tipo: Synology/QNAP/Custom?
   - OS: _______________
   - Docker versione: _______________

5. PORTS PREFERITI:
   - Frontend: ___ (default 3000)
   - Backend: ___ (default 8000)
   - PostgreSQL: ___ (default 5432, internal)

6. SMTP/EMAIL:
   - Needed? SI/NO
   - Provider: _______________

7. TIMEZONE:
   - Timezone server: _______________
```

---

## **15. Note Finali**

### Principi Architettura
1. **Flessibilità First**: Python + JSONB permettono schema changes rapidi
2. **Separation of Concerns**: Frontend/Backend/DB indipendenti
3. **Multi-tenant Ready**: Ogni feature pensata per multiple users/houses
4. **Integration Ready**: MQTT, REST API, CSV import/export
5. **Future-Proof**: Structure permette aggiunta LLM, HA, n8n senza refactoring

### Decisioni Design
- JWT per stateless auth (scalabile)
- JSONB ingredients/tags per flessibilità
- Nutrienti pre-calcolati al salvataggio (no calcoli runtime)
- Inviti con codice 6 char (UX semplice)
- MQTT per real-time HA (non polling)

### Stack Finale
```
Frontend:  React 18 + TypeScript + Vite
Backend:   Python 3.11 + FastAPI
Database:  PostgreSQL 14
Auth:      JWT + bcrypt
Real-time: MQTT
Hosting:   Docker Compose on NAS
```

---

## **PROSSIMI STEP CONCRETI**

Una volta il programmatore ha questo documento:

1. **Setup locale**:
   ```bash
   git clone <repo>
   cd hms
   docker-compose up -d
   ```

2. **Migrazioni DB**:
   ```bash
   docker-compose exec backend alembic upgrade head
   docker-compose exec backend python -m app.db.seed
   ```

3. **Primo avvio**:
   - Swagger docs: http://nas:8000/docs
   - Frontend: http://nas:3000
   - Registra account di test

4. **Integration test**:
   - Registrati
   - Crea ricetta
   - Registra pasto
   - Leggi Grocy

---

**Documento Completo - Pronto per Hand-off al Programmatore**

*Per domande durante lo sviluppo, consultare docs/ folder dettagliato.*

