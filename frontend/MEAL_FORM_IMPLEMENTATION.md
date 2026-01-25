# Meal Form Implementation - Task F2

## Overview
Implementazione completa del form di registrazione pasti nel frontend React, come specificato in TASKS.md sezione F2.

**Data**: 2026-01-13
**Directory**: `/Users/gimmidefranceschi/HomeLab/food/meal-planner/frontend/`

---

## File Creati

### Componenti Meals (`src/components/Meals/`)

1. **MealTypeSelector.tsx**
   - Selettore visuale per tipo pasto (colazione, spuntino, pranzo, cena)
   - Bottoni con icone ed effetti hover
   - Stato attivo evidenziato con colori blu

2. **RecipeSelector.tsx**
   - Dropdown per selezione ricetta esistente
   - Caricamento automatico ricette dalla casa corrente
   - Mostra valori nutrizionali della ricetta selezionata
   - Stati di loading, error ed empty

3. **PortionInput.tsx**
   - Input per moltiplicatore porzione (0.5x - 2x)
   - Bottoni quick-select (1/2, 1, 1.5, 2 porzioni)
   - Slider visuale per regolazione fine
   - Calcolo real-time valori nutrizionali per la porzione scelta

4. **SaveAsRecipeToggle.tsx**
   - Checkbox per salvare pasto libero come ricetta
   - Input condizionale per nome ricetta
   - Design con bordi arrotondati e sfondo grigio

5. **IngredientSearch.tsx**
   - Autocomplete con debounce (300ms)
   - Ricerca ingredienti tramite `foodsService.search()`
   - Dropdown risultati con navigazione tastiera (frecce, Enter, Esc)
   - Mostra categoria e calorie per 100g
   - Click-outside per chiudere

6. **IngredientList.tsx**
   - Lista ingredienti selezionati con quantità editabili
   - Bottone rimozione per ogni ingrediente
   - Summary: conteggio ingredienti e peso totale
   - Empty state con icona e messaggio

7. **NutritionSummary.tsx**
   - Riepilogo nutrizionale calcolato in tempo reale
   - Grid responsive con 4 valori: calorie, proteine, carboidrati, grassi
   - Calcolo basato su ingredienti e Map<food_id, Food>
   - Design con sfondo verde

8. **index.ts**
   - Barrel export per tutti i componenti Meals

### Pagina Principale

9. **pages/MealForm.tsx**
   - Form completo per registrazione pasto
   - **Due modalità**:
     - **Da Ricetta**: seleziona ricetta + porzione
     - **Pasto Libero**: aggiungi ingredienti manualmente
   - Switch modalità con bottoni grandi e icone
   - Integrazione con tutti i componenti sopra
   - Calcolo nutrizionale in entrambe le modalità
   - Validazione form completa
   - Gestione errori e stati di loading
   - Salvataggio opzionale come ricetta (modalità libera)
   - Reindirizzamento a `/meals` dopo successo

---

## Aggiornamenti File Esistenti

### `src/pages/index.ts`
- Aggiunta export `MealForm`

### `src/App.tsx`
- Aggiunto import `MealForm` da `./pages`
- Route `/meals/new` ora usa `<MealForm />` invece di placeholder TODO

---

## Flusso Utente

### Modalità "Da Ricetta"
1. Seleziona tipo pasto (colazione/spuntino/pranzo/cena)
2. Seleziona ricetta dal dropdown
3. Imposta moltiplicatore porzione (0.5x - 2x)
4. Visualizza nutrienti calcolati per la porzione
5. Seleziona data/ora consumazione
6. Aggiungi note opzionali
7. Salva pasto

### Modalità "Pasto Libero"
1. Seleziona tipo pasto
2. Cerca e aggiungi ingredienti:
   - Digita nome ingrediente (autocomplete)
   - Seleziona dalla lista
   - Imposta quantità in grammi
   - Ripeti per ogni ingrediente
3. Visualizza calcolo nutrizionale real-time
4. (Opzionale) Salva anche come ricetta riutilizzabile
5. Seleziona data/ora consumazione
6. Aggiungi note opzionali
7. Salva pasto

---

## Integrazione API

### Servizi Utilizzati

**recipesService** (`src/services/recipes.ts`):
- `getAll(houseId)` - Carica ricette per dropdown

**mealsService** (`src/services/meals.ts`):
- `create(houseId, data)` - Salva nuovo pasto

**foodsService** (`src/services/foods.ts`):
- `search(query, category?, limit)` - Autocomplete ingredienti
- `getById(id)` - Carica dati nutrizionali food

### Context Utilizzati

**HouseContext** (`src/context/HouseContext.tsx`):
- `currentHouse` - Casa corrente per associare pasto

---

## Tipi TypeScript Utilizzati

Dal file `src/types/index.ts`:
- `Recipe` - Ricetta completa con ingredienti e nutrienti
- `RecipeIngredient` - Ingrediente con food_id, name, quantity_g
- `RecipeCreate` - Dati per creazione nuova ricetta
- `Meal` - Pasto registrato
- `MealCreate` - Dati per creazione nuovo pasto
- `Food` - Alimento dal database nutrizionale

---

## Stile e Design

### Classi Tailwind Utilizzate
- `btn`, `btn-primary`, `btn-secondary` - Bottoni
- `input` - Campi input
- `card` - Container con bordi e ombra
- `label` - Label per input

### Colori Primary
Definiti in `tailwind.config.js`:
- primary-50 a primary-900 (scala verde)
- Usato per focus states e bottoni primari

### Pattern UI
- Grid responsive (2 colonne mobile, 4 desktop)
- Border radius uniforme (rounded-lg)
- Transizioni smooth (transition-colors, duration-200)
- Hover states su tutti i bottoni
- Focus ring su input con colore primary
- Empty states descrittivi

---

## Validazione Form

Il form valida:
1. Casa selezionata (da context)
2. Modalità ricetta:
   - Ricetta selezionata
   - Porzione > 0
3. Modalità libera:
   - Almeno 1 ingrediente
   - Nome ricetta se "salva come ricetta" è attivo
4. Data/ora consumazione presente

Errori mostrati in banner rosso sopra i bottoni azione.

---

## Calcolo Nutrizionale

### Modalità Ricetta
- Valori base dalla ricetta (total_calories, total_proteins_g, etc.)
- Moltiplicati per `portionMultiplier`
- Mostrati in tempo reale mentre si modifica lo slider

### Modalità Libera
- Per ogni ingrediente:
  - Carica dati Food dal database
  - Calcola: `(food_value_per_100g * ingredient_quantity_g) / 100`
- Somma tutti i valori degli ingredienti
- Aggiornamento real-time quando si modifica quantità

---

## Gestione Errori

### RecipeSelector
- Loading state durante fetch ricette
- Messaggio errore se fetch fallisce
- Empty state se nessuna ricetta disponibile

### IngredientSearch
- Timeout 300ms per debounce
- Loading spinner durante search
- "Nessun ingrediente trovato" se ricerca vuota

### Form Submit
- Validazione pre-submit con messaggi specifici
- Try-catch con gestione errori API
- Mostra `error.response?.data?.detail` o messaggio generico
- Spinner + disabilitazione bottone durante submit

---

## Note Implementative

### Performance
- Debounce su search ingredienti (300ms)
- useMemo per calcoli nutrizionali
- Map<food_id, Food> per cache dati food
- Lazy loading dati food solo quando necessari

### UX
- Valori di default intelligenti:
  - Data/ora corrente per consumazione
  - 100g come quantità ingrediente di default
  - 1x come porzione di default
- Conferma visiva per ogni azione
- Transizioni smooth su tutti gli stati
- Accessibilità: label, aria-labels, focus states

### Sicurezza
- Validazione client-side completa
- Sanitizzazione input (trim su stringhe)
- Type-safety con TypeScript
- Gestione corretta token auth (via interceptors axios)

---

## Testing Manuale Suggerito

1. **Modalità ricetta**:
   - [ ] Seleziona ricetta e verifica valori nutrizionali
   - [ ] Modifica porzione e verifica ricalcolo
   - [ ] Salva e verifica redirect

2. **Modalità libera**:
   - [ ] Cerca ingrediente, verifica autocomplete
   - [ ] Aggiungi più ingredienti
   - [ ] Modifica quantità, verifica ricalcolo
   - [ ] Rimuovi ingrediente
   - [ ] Salva con e senza "salva come ricetta"

3. **Validazione**:
   - [ ] Prova submit senza ricetta (modalità ricetta)
   - [ ] Prova submit senza ingredienti (modalità libera)
   - [ ] Prova "salva come ricetta" senza nome

4. **Edge cases**:
   - [ ] Nessuna casa selezionata
   - [ ] Nessuna ricetta disponibile
   - [ ] Search ingrediente senza risultati
   - [ ] Errore di rete durante submit

---

## Prossimi Passi

1. **Backend**: Implementare endpoint `/api/v1/meals` (Task B4)
2. **Backend**: Implementare calcolo nutrizionale server-side
3. **Testing**: Aggiungere test unitari per componenti
4. **UX**: Aggiungere conferma modale prima di uscire con dati non salvati
5. **Feature**: Implementare modifica pasto esistente
6. **Feature**: Aggiungere foto al pasto (upload immagine)

---

## Dipendenze

### Necessarie per Funzionamento Completo
- Backend endpoint `/api/v1/meals` (POST)
- Backend endpoint `/api/v1/recipes` (GET, POST)
- Backend endpoint `/api/v1/foods` (GET search)
- Database foods popolato con dati nutrizionali

### Già Implementate
- HouseContext con casa corrente
- AuthContext per autenticazione
- Services per API calls
- Tipi TypeScript completi

---

**Implementato da**: Claude Code Assistant
**Status**: Completato e pronto per testing quando backend sarà disponibile
