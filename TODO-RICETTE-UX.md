# TODO — Ricette & Pasti: UX Refactor
> Obiettivo: semplificare, alleggerire, rendere ogni flusso intuitivo.
> Ogni punto è progettato per essere compatibile con gli altri.
> Ordine d'implementazione = ordine di dipendenza.

---

## FASE 1 — Fondamenta condivise
*Prima di tutto: componenti riutilizzabili su cui si appoggiano le fasi successive.*

### 1.1 Combobox cercabile — `SearchableSelect`
- [ ] Nuovo componente `src/components/ui/SearchableSelect.tsx`
- Input testo + dropdown filtrato in tempo reale
- Props: `options[]`, `value`, `onChange`, `placeholder`, `emptyLabel`
- Sostituirà: `RecipeSelector` (select nativo) e qualsiasi altro select con lista lunga
- **Non toccare ancora nessuna pagina** — solo creare il componente

### 1.2 Unificare `DeleteConfirmModal`
- [ ] Verificare che `src/components/DeleteConfirmModal.tsx` sia generico (title, message, onConfirm, onClose)
- [ ] Rimuovere il modal delete inline da `RecipeDetail.tsx` → usare quello condiviso
- Risultato: un solo punto di manutenzione per tutti i confirm-delete del progetto

### 1.3 Animazioni coerenti
- [ ] Verificare che `animate-slide-up` sia in `globals.css` (già presente ✓)
- [ ] Aggiungere `animate-fade-in` se mancante: `opacity: 0→1`, 150ms
- [ ] Tutti i modal usano `animate-slide-up` (bottom sheet mobile) o `animate-fade-in` (center desktop)
- Applicare a: `MealTypeModal` (attualmente senza animazione di chiusura)

---

## FASE 2 — Fix modal esistenti
*Correzioni puntuali, nessuna nuova feature. Compatibile con Fase 1.*

### 2.1 `MealTypeModal` — animazione chiusura
- [ ] Aggiungere stato `isClosing` + delay prima di chiamare `onClose`
- [ ] Applicare classe `animate-slide-down` sull'uscita
- [ ] Testare su mobile (bottom sheet) e desktop

### 2.2 `SaveAsProductModal` — step più chiari
- [ ] Rendere "Salta, inserisci manualmente" un **bottone** visibile, non un link nascosto sotto
- [ ] Aggiungere indicatore di step (es: `1/3 Barcode → 2/3 Nome → 3/3 Zona`)
- [ ] Se barcode non trovato: mostrare box giallo più chiaro con CTA "Continua senza barcode"
- [ ] Sticky footer con Annulla/Conferma sempre visibili (già parzialmente fatto)
- **Non cambiare la logica** — solo layout e visibilità CTA

### 2.3 `CompositionModal` — feedback % incompleta
- [ ] Se totale % < 100 al salvataggio: mostrare warning `"Composizione incompleta (X%)"` ma **permettere** il salvataggio con conferma
- [ ] Attualmente: accetta silenziosamente. Aggiungere un toast informativo.
- [ ] Il warning non è un blocco — è informazione per l'utente

### 2.4 `RecipeSelector` → sostituire con `SearchableSelect`
- [ ] In `MealForm.tsx` (modalità `from_recipe`): il flusso "inquiry" via `/recipes` è già buono → **tenerlo come default**
- [ ] Rimuovere il `<select>` nativo da `RecipeSelector.tsx`
- [ ] Sostituire con `SearchableSelect` (Fase 1.1) per i casi in cui serve inline
- [ ] Il bottone "+" nuova ricetta rimane accanto

---

## FASE 3 — Miglioramenti pagine esistenti
*Nessuna nuova pagina. Miglioramenti in-place compatibili con Fase 2.*

### 3.1 `RecipeForm` — preview macro live
- [ ] Mentre si aggiungono ingredienti: mostrare card nutrizionale in tempo reale (in fondo al form)
- [ ] Stessa card di `NutritionCard` già usata in `RecipeDetail` — **riutilizzarla**
- [ ] La card appare solo se ci sono ≥1 ingredienti con dati nutrizionali
- [ ] Nessuna chiamata API aggiuntiva: calcolo client-side dai dati food già caricati
- **Layout**: card compatta in fondo al form, non in sidebar (mobile-first)

### 3.2 `RecipeDetail` — "Prepara Pasto" senza abbandonare la pagina
- [ ] Aggiungere un **bottom drawer** (mobile) / **side panel** (desktop) per la configurazione pasto
- [ ] Contenuto drawer: `MealTypeSelector` + `PortionInput` + bottone "Salva Pasto"
- [ ] Submit chiama direttamente `mealsService.create()` senza navigare via
- [ ] Successo: toast "Pasto registrato" + drawer si chiude → si rimane su RecipeDetail
- [ ] Il bottone "Prepara Pasto" esistente apre il drawer invece di navigare
- **Nota**: mantenere anche il link `/meals/new?recipe_id=X` per chi vuole il form completo

### 3.3 `RecipeDetail` — layout ingredienti più leggero
- [ ] La tabella ingredienti (`IngredientTable`) su mobile è pesante visivamente
- [ ] Sostituire con lista compatta: `nome · quantità · kcal` su una riga, senza header tabella
- [ ] Su desktop: tabella rimane (più spazio disponibile)
- [ ] Usare `hidden sm:table` / `sm:hidden` per gestire i due layout

---

## FASE 4 — Feature: Genera Ricetta AI
*Dipende da Fase 1 (componenti) e Fase 3 (RecipeForm funziona bene).*
*Backend richiede nuovo endpoint.*

### 4.1 Backend — endpoint `POST /recipes/generate`
- [ ] Nuovo file `backend/app/api/v1/recipe_ai.py`
- [ ] Input: `{ house_id, pantry_items?: [], constraints?: string, servings?: int }`
- [ ] Usa `get_llm_manager()` con purpose `chat` (o nuovo purpose `recipe`)
- [ ] Prompt strutturato: ingredienti disponibili + vincoli → JSON ricetta
- [ ] Output: schema `RecipeCreate` compatibile con l'endpoint esistente `POST /recipes`
- [ ] Aggiungere route in `router.py`

### 4.2 Frontend — Modal `GenerateRecipeModal`
- [ ] Nuovo `src/components/Recipes/GenerateRecipeModal.tsx`
- [ ] UI: bottom sheet con 3 campi opzionali:
  - "Usa ingredienti dalla dispensa" (toggle, default ON)
  - "Vincoli / preferenze" (input testo, es: "senza glutine", "veloce")
  - "Porzioni" (number, default 2)
- [ ] Loading state: skeleton + messaggio "L'AI sta pensando..."
- [ ] Risultato: preview ricetta generata con ingredienti e macro
- [ ] Azioni: "Salva ricetta" / "Rigenera" / "Modifica prima di salvare"
- [ ] "Modifica prima di salvare" → pre-compila `RecipeForm` con i dati generati

### 4.3 Collegamento UI
- [ ] In `Recipes.tsx` (lista ricette): aggiungere bottone "✨ Genera con AI" accanto a "Nuova Ricetta"
- [ ] Il bottone appare solo se LLM è configurato (`useLLMAvailable()` hook — da creare)
- [ ] In `RecipeForm.tsx`: aggiungere link "Genera automaticamente" in header

---

## FASE 5 — RecipeForm: drag&drop ingredienti
*Facoltativa, dipende dalle Fasi 1-3. Solo se le fasi precedenti sono stabili.*

### 5.1 Riordinamento ingredienti
- [ ] Usare `@dnd-kit/core` + `@dnd-kit/sortable` (già nel progetto? verificare)
- [ ] Se non presente: `npm install @dnd-kit/core @dnd-kit/sortable`
- [ ] Aggiungere handle drag sull'`IngredientList` in `RecipeForm`
- [ ] Il riordinamento è solo visivo/UX — non cambia il calcolo nutrizionale
- [ ] **Non applicare** a `MealForm` (lista ingredienti lì è più semplice)

---

## Regole trasversali (rispettare su ogni punto)

- **Mobile-first sempre**: testare ogni cambiamento su viewport 390px
- **Nessun modal dentro modal** se evitabile — usare drawer o step sequenziali
- **Toast per feedback** non alert browser nativi
- **Nessun dato esposto inutilmente**: se l'utente non ha ancora agito, non mostrare sezioni vuote
- **Colori**: usare palette Tailwind esistente (primary, gray, green, yellow, red) — nessun nuovo colore custom
- **Riutilizzo**: prima di creare un componente, cercare se esiste già in `src/components/`

---

## Ordine di esecuzione raccomandato

```
1.1 SearchableSelect
1.2 DeleteConfirmModal unificato
1.3 Animazioni
    ↓
2.1 MealTypeModal fix
2.2 SaveAsProductModal fix
2.3 CompositionModal fix
2.4 RecipeSelector → SearchableSelect
    ↓
3.1 RecipeForm preview live
3.2 RecipeDetail drawer "Prepara Pasto"
3.3 RecipeDetail lista ingredienti mobile
    ↓
4.1 Backend generate endpoint
4.2 GenerateRecipeModal
4.3 Collegamento UI
    ↓
5.1 Drag&drop (opzionale)
```

---

*Aggiornato: 2026-03-07*
