# Meal Planner - Log di Sviluppo

## Panoramica Progetto

Sistema di pianificazione pasti con:
- **Backend**: FastAPI + PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Containerizzazione**: Docker Compose (development e production)
- **Autenticazione**: JWT (access + refresh tokens)
- **Multi-tenancy**: Sistema "House" per famiglie/gruppi

---

## Modifiche Implementate

### 1. Backend - Autenticazione (deps.py)

**File**: `backend/app/api/v1/deps.py`

- Implementata validazione JWT completa
- La funzione `get_current_user()` ora:
  - Estrae il token dall'header Authorization
  - Verifica il token con `verify_token()`
  - Recupera l'utente dal database con `get_user_by_id()`
  - Restituisce l'oggetto User autenticato

### 2. Backend - Endpoints Ricette (recipes.py)

**File**: `backend/app/api/v1/recipes.py`

- Sbloccati gli endpoint POST, PUT, DELETE (erano stub 501)
- Aggiunta funzione `verify_house_membership()` per verificare l'appartenenza dell'utente alla casa
- Implementati:
  - `POST /recipes` - Crea nuova ricetta
  - `PUT /recipes/{id}` - Modifica ricetta
  - `DELETE /recipes/{id}` - Elimina ricetta

### 3. Backend - Schema Ingredienti (recipe.py)

**File**: `backend/app/schemas/recipe.py`

- Aggiornato `RecipeIngredient` con nuovi campi:
  - `quantity`: valore numerico della quantità
  - `unit`: unità di misura (g, kg, ml, cucchiaio, ecc.)
  - `quantity_g`: quantità convertita in grammi

### 4. Backend - Service Ricette (recipe_service.py)

**File**: `backend/app/services/recipe_service.py`

- Aggiornato formato JSONB per includere quantity e unit negli ingredienti

### 5. Backend - Fix bcrypt/passlib

**File**: `backend/requirements.txt`

- Aggiunto pin esplicito `bcrypt==4.0.1` per compatibilità con passlib
- Risolto errore: `AttributeError: module 'bcrypt' has no attribute '__about__'`

### 6. Backend - CORS

**File**: `backend/app/middleware/cors.py`

- Aggiunte origini per porta 5052:
  - `http://localhost:5052`
  - `http://127.0.0.1:5052`

### 7. Backend - Dockerfile

**File**: `backend/Dockerfile`

- Aggiunto stage `development` per docker-compose.dev.yml

### 8. Frontend - Componente DynamicIngredientInput

**File**: `frontend/src/components/Recipes/DynamicIngredientInput.tsx` (NUOVO)

- Input dinamico per ingredienti ricetta con:
  - Ricerca alimenti con dropdown e debounce
  - Input numerico per quantità
  - Selettore unità (g, kg, ml, l, cucchiaio, cucchiaino, tazza, pezzi)
  - Pulsante "+" per aggiungere righe
  - Pulsante "X" per rimuovere righe
  - Anteprima valori nutrizionali per ingrediente
  - Conversione automatica unità → grammi

### 9. Frontend - Form Ricette

**File**: `frontend/src/pages/RecipeForm.tsx`

- Integrato `DynamicIngredientInput`
- Usa `HouseContext` per house_id
- Validazione e submit del form

### 10. Frontend - Service Ricette

**File**: `frontend/src/services/recipes.ts`

- Tutti i metodi ora passano `house_id` come query parameter

### 11. Frontend - AuthContext

**File**: `frontend/src/context/AuthContext.tsx`

- Fix login/register: ora fa fetch separato per dati utente dopo aver salvato i token
- Prima: `setUser(response.user)` - falliva perché backend non restituisce user
- Dopo: `const userData = await authService.getMe(); setUser(userData)`

### 12. Frontend - Auth Service

**File**: `frontend/src/services/auth.ts`

- Corretti tipi: `login()` e `register()` ora restituiscono `AuthTokens` (non `AuthTokens & { user: User }`)

### 13. Frontend - Types

**File**: `frontend/src/types/index.ts`

- `RecipeIngredient`: aggiunti campi `quantity`, `unit`, `quantity_g`
- `House.members`: reso opzionale (`members?: HouseMember[]`)

### 14. Frontend - House Page

**File**: `frontend/src/pages/House.tsx`

- Fix accesso a `members` con optional chaining:
  - `currentHouse.members?.length || 0`
  - `(currentHouse.members || []).map(...)`

### 15. Frontend - Dockerfile

**File**: `frontend/Dockerfile`

- Aggiunto stage `development`

### 16. Docker Compose - Porta Frontend

**Files**: `docker-compose.yml`, `docker-compose.dev.yml`

- Cambiata porta frontend da 3000 a 5052

### 17. Database Seeding

**File**: `backend/app/db/seed.py`

- Corretto percorso CSV: `Path(__file__).parent.parent.parent / "data" / "nutrizione_pulito.csv"`
- Database popolato con 190 alimenti

---

## Configurazione Ambiente

### File .env

```env
DB_PASSWORD=<password-sicura>
SECRET_KEY=<chiave-jwt-generata>
JWT_EXPIRATION=3600
REFRESH_TOKEN_EXPIRATION=604800
VITE_API_URL=http://localhost:8000/api/v1
```

### Comandi Docker

```bash
# Avvio development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Stop
docker compose down

# Rebuild backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml build backend --no-cache

# Logs
docker logs meal-planner-backend --tail=50
docker logs meal-planner-frontend --tail=50

# Seed database
docker exec meal-planner-backend python -m app.db.seed

# Accesso database
docker exec meal-planner-db psql -U meal_planner -d meal_planner_db
```

### URL Servizi

- **Frontend**: http://localhost:5052
- **Backend API**: http://localhost:8000/api/v1
- **API Docs**: http://localhost:8000/docs
- **Database**: localhost:5432

---

## Problemi Risolti

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| 501 Not Implemented su auth | `deps.py` era stub | Implementata validazione JWT |
| 501 su POST/PUT/DELETE ricette | Endpoints erano stub | Implementati con verifica membership |
| bcrypt error | Incompatibilità passlib/bcrypt 4.x | Pin `bcrypt==4.0.1` |
| CORS preflight 400 | Porta 5052 non in whitelist | Aggiunta a cors.py |
| Login non funziona | Backend non restituisce user nei token | Fetch separato con getMe() |
| House crash | `members` undefined | Optional chaining |
| CSV not found | Path errato in seed.py | Corretto path relativo |
| Dockerfile stage error | Mancava stage "development" | Aggiunto a entrambi i Dockerfile |

---

## Struttura Database

### Tabelle Principali

- `users` - Utenti registrati
- `houses` - Case/gruppi familiari
- `user_house` - Membership (relazione N:N)
- `foods` - Database nutrizionale (190 alimenti)
- `recipes` - Ricette con ingredienti JSONB
- `meals` - Pasti registrati
- `house_invites` - Codici invito

---

## Prossimi Passi

1. Testare creazione ricette con nuovo form ingredienti
2. Implementare calcolo automatico valori nutrizionali totali
3. Aggiungere integrazione Grocy per inventario
4. Implementare pianificazione settimanale pasti
