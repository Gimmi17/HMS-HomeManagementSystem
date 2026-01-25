# Task B5: Foods + Health Implementation

**Data**: 2026-01-13
**Status**: Completed
**Task**: Implementazione modelli Food (database nutrienti) e Health (peso, salute) per backend FastAPI

---

## Files Creati

### Models (SQLAlchemy ORM)

#### `/app/models/food.py`
- **Model**: `Food`
- **Tabella**: `foods`
- **Funzione**: Database nutrienti importato da CSV (192 alimenti)
- **Campi**:
  - `name` (String, unique, indexed) - Nome alimento
  - `category` (String, indexed) - Categoria (Carne, Verdura, Frutta, etc.)
  - **Macronutrienti**: proteins_g, fats_g, carbs_g, fibers_g
  - **Acidi grassi essenziali**: omega3_ala_g, omega6_g
  - **Minerali**: calcium_g, iron_g, magnesium_g, potassium_g, zinc_g
  - **Vitamine**: vitamin_a_g, vitamin_c_g, vitamin_d_g, vitamin_e_g, vitamin_k_g, vitamin_b6_g, folate_b9_g, vitamin_b12_g
- **Note**: Tutti i valori sono per 100g di alimento
- **Indici**: name, category, composite (name+category)

#### `/app/models/weight.py`
- **Model**: `Weight`
- **Tabella**: `weights`
- **Funzione**: Tracking misurazioni peso utente
- **Campi**:
  - `user_id` (UUID, FK → users)
  - `house_id` (UUID, FK → houses)
  - `weight_kg` (Numeric, required)
  - `measured_at` (DateTime, required, indexed)
  - `notes` (Text, optional)
- **Features**:
  - Property `weight_lbs` per conversione in libbre
  - Cascading delete (se user o house vengono eliminati)
- **Use cases**: Trend peso, obiettivi fitness, monitoraggio salute

#### `/app/models/health_record.py`
- **Model**: `HealthRecord`
- **Tabella**: `health_records`
- **Funzione**: Tracking eventi salute e sintomi
- **Campi**:
  - `user_id` (UUID, FK → users)
  - `house_id` (UUID, FK → houses)
  - `type` (String, indexed) - Tipo evento (cold, flu, headache, allergy, etc.)
  - `description` (Text, required) - Descrizione dettagliata
  - `severity` (String) - Gravità: mild, moderate, severe
  - `recorded_at` (DateTime, required, indexed)
- **Features**:
  - Property `severity_emoji` per rappresentazione UI (🟢🟡🔴)
  - Validazione severity in schema Pydantic
- **Use cases**: Tracciare correlazioni tra dieta e salute, allergie, sintomi

---

### Schemas (Pydantic)

#### `/app/schemas/food.py`
Request/response models per API Foods:
- `FoodBase` - Base schema con campi comuni
- `FoodNutrients` - Schema completo nutrienti
- `FoodResponse` - Response completo (GET /foods/{id})
- `FoodSearchResult` - Response semplificato per search/autocomplete
- `FoodListResponse` - Response paginato con metadata
- `CategoryResponse` - Lista categorie uniche

**Validazione**: Pydantic v2 con ConfigDict, Field constraints

#### `/app/schemas/health.py`
Request/response models per API Health:

**Weight schemas:**
- `WeightBase` - Base schema
- `WeightCreate` - POST /weights
- `WeightUpdate` - PUT /weights/{id} (partial update)
- `WeightResponse` - Response singolo
- `WeightListResponse` - Response paginato

**HealthRecord schemas:**
- `HealthRecordBase` - Base schema
- `HealthRecordCreate` - POST /health
- `HealthRecordUpdate` - PUT /health/{id} (partial update)
- `HealthRecordResponse` - Response singolo
- `HealthRecordListResponse` - Response paginato

**Dashboard (optional):**
- `HealthDashboardResponse` - Summary dati health per dashboard

**Validazione speciale**:
- `severity` validator: accetta solo 'mild', 'moderate', 'severe' (case-insensitive)
- `weight_kg` constraints: gt=0, le=500

---

### Services (Business Logic)

#### `/app/services/health_service.py`
Funzioni business logic per health tracking:

**Weight functions:**
- `create_weight(db, user_id, house_id, weight_data)` - Crea misurazione peso
- `get_weights(db, house_id, user_id?, from_date?, to_date?, limit, offset)` - Lista pesi con filtri
- `get_weight_by_id(db, weight_id, house_id)` - Get singolo peso
- `update_weight(db, weight_id, house_id, weight_data)` - Update peso
- `delete_weight(db, weight_id, house_id)` - Delete peso

**HealthRecord functions:**
- `create_health_record(db, user_id, house_id, record_data)` - Crea record salute
- `get_health_records(db, house_id, user_id?, type?, severity?, from_date?, to_date?, limit, offset)` - Lista records con filtri
- `get_health_record_by_id(db, record_id, house_id)` - Get singolo record
- `update_health_record(db, record_id, house_id, record_data)` - Update record
- `delete_health_record(db, record_id, house_id)` - Delete record

**Analytics functions:**
- `get_weight_trend(db, user_id, house_id, days)` - Calcola trend peso (up/down/stable)
- `get_health_event_summary(db, user_id, house_id, days)` - Summary eventi salute

**Note**:
- Tutte le funzioni verificano `house_id` per multi-tenant security
- Supporto per filtri avanzati (date range, type, severity)
- Paginazione su tutti i listing endpoints

---

### API Endpoints

#### `/app/api/v1/foods.py`
Endpoints READ-ONLY per database nutrienti:

**GET /api/v1/foods**
- Search alimenti con filtri
- Query params: `search`, `category`, `limit`, `offset`
- Response: `FoodListResponse` paginato
- Use case: Autocomplete ingredienti in recipe forms

**GET /api/v1/foods/categories**
- Lista categorie uniche
- Response: `CategoryResponse`
- Use case: Populate category filter dropdown

**GET /api/v1/foods/{food_id}**
- Dettaglio completo alimento
- Response: `FoodResponse` con tutti i nutrienti
- Use case: Visualizzare profilo nutrizionale completo

**Caratteristiche**:
- Case-insensitive search (ILIKE)
- Paginazione con metadata
- Ordinamento alfabetico
- Nessuna autenticazione richiesta (MVP)

#### `/app/api/v1/health.py`
Endpoints CRUD per health tracking:

**Weight endpoints:**
- `POST /api/v1/weights` - Crea misurazione peso
- `GET /api/v1/weights` - Lista pesi (filtri: house_id, user_id, from_date, to_date)
- `GET /api/v1/weights/{id}` - Get singolo peso
- `PUT /api/v1/weights/{id}` - Update peso (partial update)
- `DELETE /api/v1/weights/{id}` - Delete peso (204 No Content)

**HealthRecord endpoints:**
- `POST /api/v1/health` - Crea health record
- `GET /api/v1/health` - Lista records (filtri: house_id, user_id, type, severity, from_date, to_date)
- `GET /api/v1/health/{id}` - Get singolo record
- `PUT /api/v1/health/{id}` - Update record (partial update)
- `DELETE /api/v1/health/{id}` - Delete record (204 No Content)

**Sicurezza**:
- Query param `house_id` richiesto per isolation multi-tenant
- Query param `user_id` richiesto per POST (TODO: inferire da JWT)
- Tutti i get/update/delete verificano house_id prima di operare
- TODO: Aggiungere autenticazione JWT (`current_user` dependency)

---

### Database Seeding

#### `/app/db/seed.py`
Script import CSV → database foods:

**Funzioni**:
- `parse_decimal(value)` - Parse string → Decimal, gestisce valori vuoti/invalidi
- `seed_foods(db, csv_path, skip_duplicates)` - Import CSV con statistiche
- `main()` - Entry point script

**CSV Column Mapping**:
```
Column 1  → name (Alimento)
Column 2  → category (Categoria)
Column 3  → proteins_g
Column 5  → fats_g
Column 7  → carbs_g
Column 9  → fibers_g
Column 11 → omega3_ala_g
Column 13 → omega6_g
Column 15 → calcium_g
Column 17 → iron_g
Column 19 → magnesium_g
Column 21 → potassium_g
Column 23 → zinc_g
Column 25 → vitamin_a_g
Column 27 → vitamin_c_g
Column 29 → vitamin_d_g
Column 31 → vitamin_e_g
Column 33 → vitamin_k_g
Column 35 → vitamin_b6_g
Column 37 → folate_b9_g
Column 39 → vitamin_b12_g
```

**CSV Path**: `/Users/gimmidefranceschi/HomeLab/food/nutrizione_pulito.csv`

**Usage**:
```bash
# Local
python -m app.db.seed

# Docker
docker-compose exec backend python -m app.db.seed
```

**Output**:
- Statistiche: total rows, inserted, updated, skipped, errors
- Exit code: 0 = success, 1 = errors
- Duplicates handling: skip by default (based on food name)

---

## Modifiche a File Esistenti

### `/app/models/__init__.py`
Aggiunto export modelli:
```python
from app.models.food import Food
from app.models.weight import Weight
from app.models.health_record import HealthRecord

__all__ = [..., "Food", "Weight", "HealthRecord"]
```

### `/app/api/v1/router.py`
Aggiunto include routers:
```python
from app.api.v1 import foods, health

api_router.include_router(foods.router, tags=["Foods"])
api_router.include_router(health.router, tags=["Health"])
```

---

## Test Endpoints (Swagger)

Dopo startup, visitare: `http://localhost:8000/docs`

### Test Foods API

1. **GET /api/v1/foods?search=pollo**
   - Cerca alimenti con "pollo" nel nome
   - Verifica search case-insensitive

2. **GET /api/v1/foods/categories**
   - Lista tutte le categorie
   - Verifica presenza: Carne, Verdura, Frutta, etc.

3. **GET /api/v1/foods/{id}**
   - Scegli un ID dalla lista precedente
   - Verifica nutrienti completi (macro + micro)

### Test Health API

1. **POST /api/v1/weights?house_id=xxx&user_id=xxx**
   ```json
   {
     "weight_kg": 75.5,
     "measured_at": "2024-01-13T08:00:00Z",
     "notes": "Morning weight"
   }
   ```
   - Verifica creazione con ID e timestamps

2. **GET /api/v1/weights?house_id=xxx&user_id=xxx**
   - Verifica lista pesi con filtri
   - Test paginazione: limit=10, offset=0

3. **POST /api/v1/health?house_id=xxx&user_id=xxx**
   ```json
   {
     "type": "headache",
     "description": "Severe headache after lunch",
     "severity": "moderate",
     "recorded_at": "2024-01-13T14:30:00Z"
   }
   ```
   - Verifica validazione severity (solo mild/moderate/severe)

4. **GET /api/v1/health?house_id=xxx&type=headache**
   - Filtra per tipo evento
   - Verifica ordinamento (più recenti prima)

---

## Database Schema

### Tabella: `foods`
```sql
CREATE TABLE foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    proteins_g NUMERIC(8,2),
    fats_g NUMERIC(8,2),
    carbs_g NUMERIC(8,2),
    fibers_g NUMERIC(8,2),
    omega3_ala_g NUMERIC(8,4),
    omega6_g NUMERIC(8,4),
    calcium_g NUMERIC(8,4),
    iron_g NUMERIC(8,4),
    magnesium_g NUMERIC(8,4),
    potassium_g NUMERIC(8,4),
    zinc_g NUMERIC(8,4),
    vitamin_a_g NUMERIC(8,6),
    vitamin_c_g NUMERIC(8,4),
    vitamin_d_g NUMERIC(8,6),
    vitamin_e_g NUMERIC(8,6),
    vitamin_k_g NUMERIC(8,6),
    vitamin_b6_g NUMERIC(8,6),
    folate_b9_g NUMERIC(8,6),
    vitamin_b12_g NUMERIC(8,6),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_foods_category ON foods(category);
```

### Tabella: `weights`
```sql
CREATE TABLE weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    weight_kg NUMERIC(6,2) NOT NULL,
    measured_at TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_weights_user ON weights(user_id);
CREATE INDEX idx_weights_house ON weights(house_id);
CREATE INDEX idx_weights_measured_at ON weights(measured_at);
```

### Tabella: `health_records`
```sql
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    type VARCHAR(100),
    description TEXT NOT NULL,
    severity VARCHAR(50),
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_health_user ON health_records(user_id);
CREATE INDEX idx_health_house ON health_records(house_id);
CREATE INDEX idx_health_type ON health_records(type);
CREATE INDEX idx_health_recorded_at ON health_records(recorded_at);
```

---

## Prossimi Step

### Immediate (da fare subito)
1. **Seed database**: Eseguire `python -m app.db.seed` per importare 192 alimenti
2. **Test API**: Verificare tutti gli endpoint in Swagger UI
3. **Verificare FK**: Assicurarsi che esistano tabelle `users` e `houses` per foreign keys

### Authentication (TODO)
- Aggiungere `Depends(get_current_user)` agli endpoint health
- Inferire `user_id` dal JWT token invece di query param
- Verificare permissions: user può modificare solo propri dati o se house admin

### Ottimizzazioni Future
- **Caching**: Redis cache per foods (query frequenti)
- **Full-text search**: PostgreSQL tsvector per search avanzato
- **Composite indexes**: (user_id, measured_at) per query weight trend
- **Analytics endpoints**: Esporre get_weight_trend e get_health_event_summary come API

### Integrazioni
- **Recipes**: Usare Food model per calcolo nutrienti ricette
- **Meals**: Usare Food model per calcolo nutrienti pasti
- **Dashboard**: Creare endpoint /health/dashboard con summary completo

---

## File Structure Finale

```
backend/app/
├── models/
│   ├── food.py                   ✓ Creato
│   ├── weight.py                 ✓ Creato
│   └── health_record.py          ✓ Creato
├── schemas/
│   ├── food.py                   ✓ Creato
│   └── health.py                 ✓ Creato
├── services/
│   └── health_service.py         ✓ Creato
├── api/v1/
│   ├── foods.py                  ✓ Creato
│   ├── health.py                 ✓ Creato
│   └── router.py                 ✓ Aggiornato
├── db/
│   ├── seed.py                   ✓ Creato
│   └── README.md                 ✓ Creato
```

---

## Note Implementazione

### Design Decisions

1. **Tutti i nutrienti in grammi**: Facilitates consistent calculations
2. **Values per 100g**: Standard in nutritional databases, easy to scale
3. **Decimal type**: Avoids floating-point precision errors
4. **Multi-tenant security**: All queries verify house_id
5. **Partial updates**: PUT endpoints support optional fields
6. **Pagination**: All list endpoints support limit/offset
7. **Soft deletes**: Not implemented (use CASCADE DELETE)

### Code Quality
- **Extensive comments**: Every function, field, and class documented
- **Type hints**: Full typing for Python 3.11+
- **Pydantic validation**: Input validation at schema level
- **Error handling**: Proper HTTP status codes (404, 400, 204)
- **Service layer**: Business logic separated from API routes

### Performance Considerations
- **Indexes**: All commonly queried fields indexed
- **Eager loading**: Can add joinedload() if needed
- **Query optimization**: Filter before count, limit results
- **Connection pooling**: Managed by SQLAlchemy SessionLocal

---

**Implementation completed successfully!**

Frontend può ora:
1. Search foods per autocomplete ingredienti
2. Get complete nutritional data per alimenti
3. CRUD weight measurements
4. CRUD health records
5. Filter and paginate health data

Next: Implement Recipes (B4) che utilizzerà Food model per calcoli nutrizionali.
