# Recipe Form Implementation - Documentation

## Overview
Implementazione completa del form per creazione e modifica ricette nel frontend React del Meal Planner.

**Data implementazione**: 2026-01-13
**Task riferimento**: TASKS.md - F1 (Recipe Form)

---

## Files Creati

### Componenti (`/frontend/src/components/Recipes/`)

1. **IngredientSearch.tsx** (4.9 KB)
   - Componente autocomplete per ricerca ingredienti
   - Debounce 300ms sulla ricerca
   - Dropdown con risultati da `foodsService.search()`
   - Preview nutrienti per ogni ingrediente
   - Click outside per chiudere dropdown
   - Gestione loading state

2. **IngredientList.tsx** (6.3 KB)
   - Lista ingredienti aggiunti alla ricetta
   - Modifica quantità inline con doppio click
   - Validazione quantità (solo numeri positivi)
   - Rimozione ingrediente con conferma visuale
   - Display nutrienti calcolati per quantità
   - Empty state quando nessun ingrediente

3. **NutritionSummary.tsx** (6.0 KB)
   - Card riepilogo valori nutrizionali totali
   - Visualizzazione calorie totali (grande, highlight)
   - Progress bar per ogni macronutriente
   - Calcolo percentuali proteine/carbo/grassi
   - Calcolo calorie da ogni macro (P/C=4kcal/g, F=9kcal/g)
   - Color-coded: proteine=blu, carboidrati=verde, grassi=arancione

4. **TagInput.tsx** (2.8 KB)
   - Input per aggiungere tags multipli
   - Aggiungi con Enter
   - Rimozione tag con bottone X
   - Validazione duplicati (case-insensitive)
   - Visual chips per tags
   - Helper text per guidare utente

5. **index.ts**
   - Export centralizzato componenti
   - Export types (IngredientInput)

### Pagina (`/frontend/src/pages/`)

6. **RecipeForm.tsx** (14.5 KB)
   - Pagina principale form ricetta
   - Supporta creazione (`/recipes/new`) e modifica (`/recipes/:id/edit`)
   - Form con validazione completa
   - Sezioni: info base, ingredienti, procedimento, tags
   - Calcolo nutrizione in tempo reale
   - Sidebar sticky con riepilogo nutrienti
   - Gestione stati: loading, saving, error
   - Conferma prima di annullare con modifiche

### Aggiornamenti File Esistenti

7. **App.tsx** - Aggiornato
   - Importato `RecipeForm`
   - Route `/recipes/new` → RecipeForm (creazione)
   - Route `/recipes/:id/edit` → RecipeForm (modifica)
   - Route `/recipes/:id` → TODO dettaglio (F3)

---

## Struttura Form

### Informazioni Base
- **Nome ricetta** (obbligatorio)
- **Descrizione** (opzionale, textarea)
- **Tempo preparazione** (minuti, number input)
- **Difficoltà** (select: easy/medium/hard)

### Ingredienti (obbligatorio almeno 1)
1. Search box con autocomplete
2. Prompt per quantità in grammi
3. Lista ingredienti con quantità editabili
4. Rimozione singolo ingrediente

### Procedimento
- Textarea multiriga per step preparazione

### Tags
- Input con chips visuali
- Aggiungi multipli (Enter per confermare)

### Sidebar
- Riepilogo nutrizione totale in tempo reale
- Bottoni Salva/Annulla sticky

---

## Logica Calcolo Nutrienti

### Dati Database (per 100g)
I dati Food nel database contengono valori nutrizionali per 100g:
```typescript
interface Food {
  calories?: number      // kcal per 100g
  proteins_g: number     // grammi per 100g
  carbs_g: number        // grammi per 100g
  fats_g: number         // grammi per 100g
}
```

### Calcolo per Quantità
Quando si aggiunge un ingrediente con quantità personalizzata:
```typescript
const ratio = quantity_g / 100
const nutrition = {
  calories: food.calories * ratio,
  proteins_g: food.proteins_g * ratio,
  carbs_g: food.carbs_g * ratio,
  fats_g: food.fats_g * ratio,
}
```

### Calcolo Totali
Somma di tutti gli ingredienti:
```typescript
ingredients.reduce((totals, ingredient) => ({
  calories: totals.calories + ingredient.calories,
  proteins_g: totals.proteins_g + ingredient.proteins_g,
  carbs_g: totals.carbs_g + ingredient.carbs_g,
  fats_g: totals.fats_g + ingredient.fats_g,
}), { calories: 0, proteins_g: 0, carbs_g: 0, fats_g: 0 })
```

---

## API Integration

### Services Utilizzati

1. **foodsService.search(query)**
   - Endpoint: `GET /api/v1/foods?search={query}`
   - Ritorna: `Food[]`
   - Uso: autocomplete ingredienti

2. **recipesService.create(houseId, data)**
   - Endpoint: `POST /api/v1/recipes`
   - Payload: `RecipeCreate`
   - Ritorna: `Recipe`

3. **recipesService.update(id, data)**
   - Endpoint: `PUT /api/v1/recipes/{id}`
   - Payload: `Partial<RecipeCreate>`
   - Ritorna: `Recipe`

4. **recipesService.getById(id)**
   - Endpoint: `GET /api/v1/recipes/{id}`
   - Ritorna: `Recipe`
   - Uso: caricamento dati in edit mode

### Payload Ricetta
```typescript
{
  name: string                    // obbligatorio
  description?: string
  procedure?: string
  preparation_time_min?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
  ingredients: [
    {
      food_id: string
      food_name: string
      quantity_g: number
    }
  ]
}
```

**Nota**: I valori nutrizionali totali (total_calories, total_proteins_g, ecc.) vengono calcolati dal backend basandosi sugli ingredienti.

---

## UX Features

### Debouncing
- Search ingredienti: 300ms dopo ultimo keystroke
- Previene troppe chiamate API durante digitazione
- Loading spinner durante ricerca

### Validazione Form
- Nome obbligatorio
- Almeno 1 ingrediente obbligatorio
- Quantità ingredienti > 0
- Messaggio errore visibile sopra il form

### Feedback Utente
1. **Loading States**
   - Loading iniziale (in edit mode)
   - Loading durante save
   - Loading durante search ingredienti

2. **Empty States**
   - Lista ingredienti vuota: messaggio + icona
   - Nutrition summary senza ingredienti: nota informativa

3. **Conferme**
   - Annulla form: conferma se ci sono modifiche
   - Rimozione ingrediente: feedback visuale immediato

### Accessibility
- Label per ogni input
- Placeholder descrittivi
- Aria-label per bottoni icona
- Focus management in modali
- Keyboard navigation (Enter, Escape)

---

## Styling (Tailwind CSS)

### Classi Custom (globals.css)
```css
.btn           → base button
.btn-primary   → primary action
.btn-secondary → secondary action
.input         → form input/textarea/select
.card          → white card with shadow
.label         → form label
```

### Color Palette
- Primary: `primary-600` (blu)
- Success: `green-500`
- Warning: `orange-500`
- Danger: `red-600`
- Neutral: `gray-X`

### Layout
- Responsive: mobile-first
- Desktop: 2 colonne (form + sidebar)
- Mobile: 1 colonna stacked
- Sidebar sticky su desktop

---

## Types Reference

### IngredientInput
```typescript
interface IngredientInput {
  food_id: string
  food_name: string
  category?: string
  quantity_g: number
  calories?: number
  proteins_g: number
  carbs_g: number
  fats_g: number
}
```

### RecipeCreate (dal types/index.ts)
```typescript
interface RecipeCreate {
  name: string
  description?: string
  procedure?: string
  ingredients: RecipeIngredient[]
  preparation_time_min?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  tags?: string[]
}
```

---

## Future Improvements

### Funzionalità Aggiuntive
1. **Autosave Draft**
   - Salva in localStorage ogni X secondi
   - Recupera draft al rientro

2. **Upload Immagine**
   - Foto della ricetta
   - Preview prima di salvare

3. **Porzioni**
   - Calcola nutrienti per N porzioni
   - Moltiplicatore quantità ingredienti

4. **Import/Export**
   - Import ricetta da URL
   - Export in PDF/Markdown

5. **Suggerimenti Smart**
   - Ingredienti simili durante ricerca
   - Tags popolari/suggeriti
   - Ricette correlate

### Ottimizzazioni
1. **Performance**
   - Virtualizzazione lista ingredienti lunghe
   - Memoization calcoli nutrienti
   - Lazy load componenti pesanti

2. **UX**
   - Drag & drop per riordinare ingredienti
   - Bulk edit ingredienti
   - Undo/redo modifiche

3. **Validazione**
   - Validazione real-time mentre digiti
   - Suggerimenti per correzioni
   - Check duplicati nome ricetta

---

## Testing Checklist

### Test Manuali Consigliati

- [ ] **Creazione Ricetta**
  - [ ] Form vuoto carica correttamente
  - [ ] Validation blocca submit senza nome
  - [ ] Validation blocca submit senza ingredienti
  - [ ] Search ingredienti funziona
  - [ ] Aggiunta ingrediente con quantità
  - [ ] Modifica quantità ingrediente
  - [ ] Rimozione ingrediente
  - [ ] Nutrition summary si aggiorna in real-time
  - [ ] Tags si aggiungono/rimuovono
  - [ ] Salvataggio redirect a /recipes
  - [ ] Annulla chiede conferma

- [ ] **Modifica Ricetta**
  - [ ] Caricamento dati esistenti
  - [ ] Form pre-compilato correttamente
  - [ ] Modifica campi esistenti
  - [ ] Aggiunta nuovo ingrediente
  - [ ] Salvataggio aggiorna ricetta
  - [ ] URL /recipes/:id/edit funziona

- [ ] **Edge Cases**
  - [ ] Search senza risultati
  - [ ] Quantità ingrediente = 0
  - [ ] Quantità ingrediente negativa
  - [ ] Nome ricetta duplicato
  - [ ] Errore API durante save
  - [ ] Errore API durante load
  - [ ] Ingrediente senza calorie (null)

- [ ] **Responsive**
  - [ ] Mobile: layout 1 colonna
  - [ ] Tablet: layout corretto
  - [ ] Desktop: sidebar sticky
  - [ ] Dropdown ingredienti non overflow

---

## Notes per il Backend

### Assunzioni Backend
Il form assume che il backend:

1. **Calcoli automaticamente i nutrienti totali**
   - Il frontend invia solo `ingredients: [{food_id, quantity_g}]`
   - Backend fa lookup food data e calcola totali
   - Ritorna recipe con total_calories, total_proteins_g, ecc.

2. **House ID**
   - Attualmente hardcoded come placeholder
   - Da sostituire con context `useHouse()` quando disponibile

3. **Food Search**
   - Supporta fuzzy matching
   - Ritorna max 50 risultati
   - Include tutti i campi nutrienti

4. **Validation**
   - Valida unicità nome ricetta per casa
   - Valida esistenza food_id
   - Valida quantità > 0

### Endpoint Richiesti
```
GET    /api/v1/foods?search=xxx           → Food[]
GET    /api/v1/recipes/:id                → Recipe
POST   /api/v1/recipes                    → Recipe
PUT    /api/v1/recipes/:id                → Recipe
DELETE /api/v1/recipes/:id                → void
```

---

## Conclusioni

Form completo e funzionale per creazione/modifica ricette con:
- UX moderna e intuitiva
- Calcolo nutrienti in tempo reale
- Validazione completa
- Design responsive
- Codice ben commentato e manutenibile

Pronto per l'integrazione con il backend quando gli endpoint saranno disponibili.

**Prossimi Step**:
- Task F3: Recipe Detail View (visualizzazione ricetta)
- Task F2: Meal Form (registrazione pasti)
