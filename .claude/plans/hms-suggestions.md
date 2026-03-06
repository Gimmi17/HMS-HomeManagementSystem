# Meal Planner - Suggerimenti ricette via LLM

## Obiettivo
Pulsante che chiede a un LLM di suggerire fino a 10 ricette dal database compatibili con i prodotti in dispensa (tutte le zone). Le ricette sono ordinate per urgenza scadenza: prodotti in scadenza imminente prima, poi per media scadenze.

---

## Architettura

```
[Frontend Button]
    → POST /api/v1/meal-planner/suggest?house_id=xxx
    → Backend raccoglie: dispensa items + ricette
    → Costruisce prompt LLM
    → LLM risponde con JSON (recipe_id + prodotti matchati)
    → Backend calcola ordinamento per scadenza
    → Ritorna lista ordinata al frontend
```

---

## File da creare/modificare

### Backend (4 nuovi, 1 modificato)

**1. `backend/app/schemas/meal_planner.py`** (NUOVO)
- `MealPlannerSuggestionRequest` — opzionale (filtri futuri)
- `MatchedProduct` — name, expiry_date
- `SuggestedRecipe` — recipe_id, recipe_name, description, difficulty, prep_time, ingredients, matched_products[], min_expiry_date, avg_expiry_date
- `MealPlannerResponse` — suggestions[], generated_at, llm_used

**2. `backend/app/services/meal_planner_service.py`** (NUOVO)
- `get_suggestions(db, house_id)`:
  1. Query dispensa items: `is_consumed=False`, tutte le zone, con `expiry_date`
  2. Query ricette: tutte le ricette della house con ingredienti (JSONB)
  3. Costruisce prompt con:
     - Lista prodotti disponibili (nome, quantita, unita, scadenza)
     - Lista ricette (id, nome, lista ingredienti food_name)
  4. Chiama LLM via `LLMManager.get_client_for_purpose(SUGGESTIONS)` (fallback GENERAL)
  5. Parsa risposta JSON del LLM
  6. Calcola ordinamento:
     - Per ogni ricetta: `min_expiry` = data scadenza minima tra i prodotti matchati
     - `avg_expiry` = media delle scadenze
     - Prodotti senza scadenza → trattati come scadenza lontana (9999-12-31)
     - Sort: `min_expiry ASC`, poi `avg_expiry ASC`
  7. Ritorna max 10 ricette ordinate

**3. `backend/app/api/v1/meal_planner.py`** (NUOVO)
- `router = APIRouter(prefix="/meal-planner")`
- `POST /suggest` — chiama `get_suggestions()`, richiede `house_id` + auth
- Gestisce errori LLM (connection not found, timeout, parse error) con messaggi chiari

**4. `backend/app/api/v1/router.py`** (MODIFICATO)
- Import `meal_planner`
- `api_router.include_router(meal_planner.router, tags=["Meal Planner"])`

### Frontend (3 nuovi, 4 modificati)

**5. `frontend/src/services/mealPlanner.ts`** (NUOVO)
- `mealPlannerService.getSuggestions(houseId)` → POST `/meal-planner/suggest`

**6. `frontend/src/pages/MealPlanner.tsx`** (NUOVO)
- Pagina con:
  - Header "Meal Planner"
  - Bottone "Suggerisci Ricette" (icona wand/magic)
  - Loading state con spinner
  - Lista ricette suggerite:
    - Nome ricetta, difficolta, tempo prep
    - Badge scadenza piu vicina (es. "Scade tra 2 giorni" in rosso)
    - Lista ingredienti matchati
    - Link a RecipeDetail
  - Stato vuoto se nessun suggerimento
  - Errore LLM con messaggio user-friendly

**7. `frontend/src/pages/index.ts`** (MODIFICATO)
- Export `MealPlanner`

**8. `frontend/src/App.tsx`** (MODIFICATO)
- Route `/meal-planner` → `<MealPlanner />`

**9. `frontend/src/components/Layout/DrawerMenu.tsx`** (MODIFICATO)
- Aggiungere `{ to: '/meal-planner', label: 'Meal Planner', icon: '🧠' }` dopo "Ricette"

**10. `frontend/src/components/Layout/Sidebar.tsx`** (MODIFICATO)
- Stessa voce menu

---

## Design del Prompt LLM

```
Sei un assistente per la pianificazione pasti.
Ti vengono forniti i prodotti disponibili in dispensa e le ricette salvate.
Identifica quali ricette si possono preparare con i prodotti disponibili.

PRODOTTI IN DISPENSA:
1. Petto di pollo (2 pz, scade: 2026-02-25)
2. Pasta penne (1 kg, scade: 2026-06-01)
3. Pomodori pelati (3 pz)
...

RICETTE:
1. [abc-123] "Pasta al pomodoro" - Ingredienti: Pasta, Pomodori, Olio d'oliva, Aglio
2. [def-456] "Pollo alla griglia" - Ingredienti: Petto di pollo, Olio, Rosmarino
...

Rispondi SOLO con un JSON array. Per ogni ricetta realizzabile, indica l'ID e
i prodotti della dispensa che verrebbero usati con la loro data di scadenza.
Includi solo ricette dove gli ingredienti PRINCIPALI sono disponibili
(condimenti base come sale, olio, spezie possono essere ignorati).
Max 10 ricette.

Formato risposta:
[
  {
    "recipe_id": "abc-123",
    "matched_products": [
      {"product_name": "Pasta penne", "expiry_date": "2026-06-01"},
      {"product_name": "Pomodori pelati", "expiry_date": null}
    ],
    "reasoning": "Tutti gli ingredienti principali disponibili"
  }
]
```

**Nota**: max_tokens aumentato a 2000 per questa chiamata (le ricette possono essere verbose).

---

## Ordinamento per scadenza

Per ogni ricetta suggerita dal LLM:
1. Raccogliere le `expiry_date` dei prodotti matchati
2. Ignorare i `null` (prodotti senza scadenza)
3. `min_expiry` = la scadenza piu vicina tra i prodotti (se tutti null → `date.max`)
4. `avg_expiry` = media delle scadenze non-null (se tutti null → `date.max`)
5. Sort primario: `min_expiry ASC` (urgenza)
6. Sort secondario: `avg_expiry ASC` (urgenza media)

---

## Gestione errori

- **Nessuna connessione LLM configurata**: risposta 400 con messaggio "Configura una connessione LLM nelle impostazioni"
- **LLM non raggiungibile**: risposta 503 con messaggio "Servizio LLM non disponibile"
- **Risposta LLM non parsabile**: tentativo di estrarre JSON parziale; se fallisce, 500 con log errore
- **Nessuna ricetta in DB**: risposta 200 con lista vuota + messaggio
- **Nessun prodotto in dispensa**: risposta 200 con lista vuota + messaggio
