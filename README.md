# Meal Planner

Sistema di meal planning intelligente e multi-utente per gestire ricette, pasti, tracking nutrizionale e integrazione con Grocy/Home Assistant.

---

## 1. Avvio del Server

Il progetto include un'interfaccia di controllo cross-platform che gestisce automaticamente Docker e la configurazione.

### Prerequisiti

- **Docker Desktop** installato e in esecuzione
- **Python 3.8+** (solo per Windows, per eseguire lo script)

### Mac / Linux

```bash
# Apri il terminale nella cartella del progetto
cd meal-planner

# Rendi eseguibile lo script (solo la prima volta)
chmod +x start.sh start.py

# Avvia l'interfaccia di controllo
./start.sh
```

Oppure con Python:
```bash
python3 start.py
```

### Windows

```batch
:: Apri il Prompt dei comandi o PowerShell nella cartella del progetto
cd meal-planner

:: Avvia l'interfaccia di controllo
start.bat
```

Oppure direttamente:
```batch
python start.py
```

### Interfaccia di Controllo

Una volta avviato, vedrai un menu interattivo:

```
  ╔════════════════════════════════════════════════════════════╗
  ║                    M E A L   P L A N N E R                  ║
  ╚════════════════════════════════════════════════════════════╝

  Status: ● Server attivo (3 container)
  Porte:  Frontend=3000 | Backend=8000 | DB=5432

  AVVIO
    1) Avvia server (development)
    2) Avvia server (production)
    3) Configura porte

  GESTIONE
    4) Ferma server
    5) Riavvia server
    6) Ricostruisci container

  MONITORAGGIO
    7) Vedi log (tutti)
    ...
```

### Avvio Rapido da Riga di Comando

```bash
# Avvia direttamente (senza menu)
python start.py up

# Avvia con porte personalizzate
python start.py up -f 3001 -b 8001

# Ferma il server
python start.py down

# Mostra i log
python start.py logs

# Mostra lo stato
python start.py status
```

### Configurazione Porte

Se le porte di default (3000, 8000, 5432) sono occupate:

1. Dal menu, seleziona **3) Configura porte**
2. Inserisci le nuove porte (il sistema mostra quali sono libere)
3. Avvia il server con **1)** o **2)**

Oppure da riga di comando:
```bash
python start.py up --frontend-port 3001 --backend-port 8001 --db-port 5433
```

### Accesso ai Servizi

Dopo l'avvio, i servizi sono disponibili a:

| Servizio       | URL                            |
|----------------|--------------------------------|
| **Frontend**   | http://localhost:3000          |
| **Backend API**| http://localhost:8000          |
| **Swagger UI** | http://localhost:8000/docs     |
| **ReDoc**      | http://localhost:8000/redoc    |

---

## 2. Come Funziona il Sistema

### Panoramica

Meal Planner e' un sistema completo per la gestione alimentare familiare:

```
┌─────────────────────────────────────────────────────────────────┐
│                         MEAL PLANNER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Ricette  │    │  Pasti   │    │ Dispensa │    │  Salute  │  │
│  │          │───>│          │<───│ (Grocy)  │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │              │                │               │         │
│       └──────────────┼────────────────┼───────────────┘         │
│                      v                v                          │
│            ┌─────────────────────────────────┐                  │
│            │   Database Nutrienti (192 cibi) │                  │
│            │   Calorie, Proteine, Grassi...  │                  │
│            └─────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Funzionalita' Principali

#### Case e Utenti
- **Multi-utente**: Ogni persona ha il proprio account
- **Case condivise**: Piu' persone possono condividere ricette e dispensa
- **Inviti**: Sistema di codici invito per aggiungere membri

#### Ricette
- Crea ricette con ingredienti dal database nutrienti
- Calcolo automatico valori nutrizionali per porzione
- Tag e categorie per organizzazione
- Procedimento passo-passo

#### Pasti
- Registra cosa mangi durante il giorno
- Seleziona da ricette salvate o inserisci manualmente
- Tracking automatico calorie e macronutrienti
- Storico consultabile

#### Integrazione Grocy
- Sincronizza inventario da Grocy
- Visualizza cosa hai in dispensa
- Suggerimenti ricette basati su disponibilita'

#### Salute
- Tracking peso nel tempo
- Calcolo BMI
- Obiettivi personalizzati

---

## Liste della Spesa

Il cuore dell'applicazione è la gestione completa delle liste della spesa, dalla creazione al controllo carico.

### Creazione Lista

Vai su **Liste Spesa → Nuova Lista** per creare una nuova lista.

| Funzione | Descrizione |
|----------|-------------|
| **Nome** | Personalizzato o generato automaticamente con data |
| **Negozio** | Associa la lista a un punto vendita specifico |
| **Articoli manuali** | Aggiungi prodotti con nome, quantità, unità e categoria |
| **Import da Grocy** | Cerca e importa prodotti dalla dispensa Grocy |
| **Recupero non acquistati** | Riprendi automaticamente gli articoli mancanti dalla spesa precedente |

### Durante la Spesa (Visualizzazione)

La schermata di visualizzazione lista permette di:

- **Spuntare articoli** - tap sull'articolo per segnarlo come preso
- **Modal post-spunta** - dopo la spunta puoi inserire:
  - Data di scadenza (formati: `DDMMYY`, `DD/MM/YYYY`, `DD/MM/YY`)
  - Barcode (manuale o tramite scansione foto)
  - Categoria prodotto
- **Aggiunta rapida** - bottone "+" in fondo alla lista per aggiungere articoli al volo
- **Sincronizzazione live** - aggiornamento automatico ogni 3 secondi tra dispositivi
- **Dati persistenti** - se togli e rimetti la spunta, i dati inseriti vengono mostrati di nuovo

### Controllo Carico

Verifica della spesa al rientro a casa. Avvia dal menu: **⋮ → Inizia Controllo Carico**

**Flusso:**
1. Clicca su un articolo in sospeso
2. Si apre il modal di verifica con:
   - **Quantità** - conferma o modifica
   - **Barcode** - inserisci manualmente o scansiona
   - **Fotocamera** - scatta foto del barcode per lettura automatica
   - **Data scadenza** - inserisci scadenza prodotto
   - **Categoria** - seleziona categoria
3. **"Verifica"** per confermare o **"Non Acquistato"** se mancante

**Funzionalità:**
- Scansione barcode da foto della fotocamera del telefono
- Lookup prodotto su Open Food Facts (mostra nome e marca)
- Tracciamento articoli non acquistati per recupero nella prossima lista
- Barra progresso verifica in tempo reale
- Gli articoli verificati non possono essere de-spuntati dalla visualizzazione

### Categorie Prodotti

Gestisci le categorie da **Impostazioni → Categorie**.

- **CRUD completo** - crea, modifica, elimina
- **Personalizzazione** - nome, descrizione, icona emoji, colore
- **Ordinamento** - definisci l'ordine di visualizzazione
- **Uso** - disponibili in creazione lista, spunta e controllo carico

### Negozi

Gestisci i negozi da **Impostazioni → Negozi**.

- **Catene** - es. Conad, Esselunga, Lidl
- **Punti vendita** - singoli negozi con indirizzo
- **Dimensioni** - piccolo, medio, grande, ipermercato

### Flusso Completo Spesa

```
1. CREAZIONE LISTA
   ├── Aggiungi articoli manualmente
   ├── Importa da Grocy (opzionale)
   ├── Recupera non acquistati dalla lista precedente
   └── Assegna negozio (opzionale)

2. DURANTE LA SPESA (sul telefono)
   ├── Spunta articoli man mano
   ├── Inserisci scadenza/barcode (opzionale)
   └── Aggiungi articoli extra con "+"

3. CONTROLLO CARICO (a casa)
   ├── Avvia verifica dal menu
   ├── Per ogni articolo:
   │   ├── Conferma quantità
   │   ├── Scansiona barcode (opzionale)
   │   ├── Inserisci scadenza
   │   └── Seleziona categoria
   └── Segna "Non Acquistato" se mancante

4. COMPLETAMENTO
   ├── Lista completata automaticamente
   └── Non acquistati recuperabili nella prossima lista
```

### Database Schema (Shopping)

```
shopping_lists
├── id (UUID)
├── house_id → houses.id
├── store_id → stores.id (opzionale)
├── name
├── status (active, completed, cancelled)
├── verification_status (not_started, in_progress, paused, completed)
├── created_at, updated_at

shopping_list_items
├── id (UUID)
├── shopping_list_id → shopping_lists.id
├── name, quantity, unit
├── checked, checked_at
├── category_id → categories.id
├── expiry_date
├── scanned_barcode
├── verified_at, verified_quantity, verified_unit
├── not_purchased, not_purchased_at
├── grocy_product_id, grocy_product_name

categories
├── id (UUID)
├── name (unique)
├── description, icon, color
├── sort_order
```

### API Endpoints (Shopping)

```
Liste Spesa
  GET    /api/v1/shopping-lists              # Lista tutte le liste
  POST   /api/v1/shopping-lists              # Crea nuova lista
  GET    /api/v1/shopping-lists/{id}         # Dettaglio con items
  PUT    /api/v1/shopping-lists/{id}         # Modifica lista
  DELETE /api/v1/shopping-lists/{id}         # Elimina lista

Items
  POST   /api/v1/shopping-lists/{id}/items                    # Aggiungi item
  PUT    /api/v1/shopping-lists/{id}/items/{item_id}          # Modifica item
  DELETE /api/v1/shopping-lists/{id}/items/{item_id}          # Elimina item
  POST   /api/v1/shopping-lists/{id}/items/{item_id}/toggle   # Spunta/despunta
  POST   /api/v1/shopping-lists/{id}/items/{item_id}/verify   # Verifica barcode
  POST   /api/v1/shopping-lists/{id}/items/{item_id}/not-purchased  # Non acquistato

Categorie
  GET    /api/v1/categories          # Lista categorie
  POST   /api/v1/categories          # Crea categoria
  PUT    /api/v1/categories/{id}     # Modifica
  DELETE /api/v1/categories/{id}     # Elimina
```

---

## Strumenti Amministrativi

### Backup & Restore

Vai su **Impostazioni → Backup & Restore**.

**Export:**
- Genera file SQL con tutti i dati
- INSERT statements ordinati per foreign keys
- Download automatico `meal_planner_backup_YYYYMMDD_HHMMSS.sql`

**Import:**
- Carica file .sql di backup
- Skip automatico duplicati (`ON CONFLICT DO NOTHING`)
- Report dettagliato esecuzione

### SQL Console

Vai su **Impostazioni → SQL Console**.

Console per eseguire query SQL direttamente sul database:
- Query di esempio precaricate
- Supporto SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE
- Risultati in tabella
- Cronologia ultime 10 query
- Accessibile via API per debug remoto

**Endpoint:** `POST /api/v1/admin/sql-console`
```json
{
  "query": "SELECT * FROM shopping_lists LIMIT 10;"
}
```

---

### Flusso Tipico

1. **Setup iniziale**: Crea account → Crea/Entra in una casa → Connetti Grocy
2. **Aggiungi ricette**: Inserisci le tue ricette con ingredienti
3. **Registra pasti**: Ogni giorno registra cosa mangi
4. **Monitora**: Controlla il tracking nutrizionale e il peso

### Database Nutrienti

Il sistema include un database di 192 alimenti con valori nutrizionali completi:

- Macronutrienti: Calorie, Proteine, Carboidrati, Grassi
- Micronutrienti: Vitamine (A, B1-B12, C, D, E, K), Minerali (Ferro, Calcio, Potassio...)
- Dati per 100g di prodotto

---

## 3. Guida per Sviluppatori

### Architettura

```
meal-planner/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # Componenti UI riutilizzabili
│   │   ├── pages/          # Pagine dell'applicazione
│   │   ├── context/        # React Context (Auth, House)
│   │   ├── services/       # Client API
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
│
├── backend/                # Python + FastAPI
│   ├── app/
│   │   ├── main.py         # Entry point
│   │   ├── core/           # Config, security
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic validation
│   │   ├── services/       # Business logic
│   │   └── api/v1/         # REST endpoints
│   ├── data/
│   │   └── nutrizione_pulito.csv   # Database nutrienti
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml      # Configurazione produzione
├── docker-compose.dev.yml  # Override per sviluppo
├── start.py                # Script controllo cross-platform
├── start.sh                # Launcher bash
└── start.bat               # Launcher Windows
```

### Stack Tecnologico

| Layer      | Tecnologia                    | Perche'                           |
|------------|-------------------------------|-----------------------------------|
| Frontend   | React 18 + TypeScript + Vite  | SPA moderna, type-safe, veloce   |
| Styling    | Tailwind CSS                  | Utility-first, no CSS custom      |
| Backend    | FastAPI + Python 3.11         | Async, auto-docs, type hints      |
| ORM        | SQLAlchemy 2.0                | Robusto, async support            |
| Database   | PostgreSQL 14                 | JSONB, affidabile, scalabile      |
| Auth       | JWT (access + refresh)        | Stateless, sicuro                 |
| Container  | Docker Compose                | Deploy semplificato               |

### Dove Mettere le Mani

#### Aggiungere una Nuova Pagina Frontend

1. Crea il file in `frontend/src/pages/NuovaPagina.tsx`
2. Esporta da `frontend/src/pages/index.ts`
3. Aggiungi la route in `frontend/src/App.tsx`

#### Aggiungere un Nuovo Endpoint API

1. Crea il file in `backend/app/api/v1/nuovo_endpoint.py`
2. Definisci lo schema Pydantic in `backend/app/schemas/`
3. Registra il router in `backend/app/main.py`

#### Aggiungere un Nuovo Modello Database

1. Crea il modello in `backend/app/models/nuovo_modello.py`
2. Importa in `backend/app/models/__init__.py`
3. Riavvia per creare la tabella automaticamente

#### Modificare gli Stili

Gli stili usano Tailwind CSS. Modifica direttamente le classi nei componenti React.
Per stili globali: `frontend/src/styles/globals.css`

### Database Schema

```
users
├── id, email, password_hash, created_at
└── houses (many-to-many via user_house)

houses
├── id, name, created_at
├── members (many-to-many via user_house)
├── invites (one-to-many)
├── recipes (one-to-many)
└── meals (one-to-many)

recipes
├── id, house_id, name, portions, procedure
├── ingredients (JSONB: [{food_id, quantity, unit}])
├── tags (JSONB: ["tag1", "tag2"])
└── total_nutrition (JSONB: calcolato)

meals
├── id, house_id, user_id, date, meal_type
├── recipe_id (nullable, se da ricetta)
└── ingredients (JSONB: manuale se senza ricetta)

foods
├── id, name, category
└── 40+ colonne nutrienti (kcal, protein, fat, fiber, vitamins...)

weights
├── id, user_id, house_id, date, value_kg
└── note
```

### API Endpoints

Documentazione completa: http://localhost:8000/docs

```
/api/v1/auth/
  POST /register     - Registrazione utente
  POST /login        - Login (ritorna JWT)
  POST /refresh      - Rinnova token

/api/v1/users/
  GET  /me           - Profilo utente corrente

/api/v1/houses/
  GET  /             - Lista case dell'utente
  POST /             - Crea nuova casa
  POST /{id}/invites - Genera codice invito
  POST /join         - Entra con codice invito

/api/v1/recipes/
  GET  /             - Lista ricette (della casa)
  POST /             - Crea ricetta
  GET  /{id}         - Dettaglio ricetta
  PUT  /{id}         - Modifica ricetta
  DELETE /{id}       - Elimina ricetta

/api/v1/meals/
  GET  /             - Lista pasti (filtrabili per data)
  POST /             - Registra pasto

/api/v1/foods/
  GET  /             - Cerca alimenti (per nome)
  GET  /{id}         - Dettaglio alimento con nutrienti

/api/v1/grocy/
  GET  /stock        - Inventario Grocy
  GET  /products     - Prodotti Grocy

/api/v1/weights/
  GET  /             - Storico peso
  POST /             - Registra peso
```

### Sviluppo Locale

```bash
# Avvia in dev mode (hot reload)
python start.py
# Seleziona 1) Avvia server (development)

# I file sono montati come volumi:
# - Modifiche frontend → ricarica automatica (Vite HMR)
# - Modifiche backend → ricarica automatica (uvicorn --reload)
```

### Variabili d'Ambiente

File `.env` (creato automaticamente da `.env.example`):

```bash
# Database
DB_PASSWORD=           # Password PostgreSQL

# Security
SECRET_KEY=            # Chiave per JWT (generata automaticamente)
JWT_EXPIRATION=3600    # Durata token (secondi)
REFRESH_TOKEN_EXPIRATION=604800

# Grocy Integration
GROCY_URL=             # http://ip:porta di Grocy
GROCY_API_KEY=         # API key da Grocy

# MQTT (opzionale)
MQTT_BROKER=           # Broker MQTT per Home Assistant
MQTT_PORT=1883
MQTT_USER=
MQTT_PASSWORD=
```

### Comandi Utili

```bash
# Seed database con alimenti
python start.py
# Seleziona 11) Seed database

# Backup database
python start.py
# Seleziona 12) Backup database

# Accedi a PostgreSQL
python start.py
# Seleziona 13) Accedi a PostgreSQL

# Oppure manualmente:
docker compose exec postgres psql -U meal_planner -d meal_planner_db

# Vedi tabelle
\dt

# Esci
\q
```

### Troubleshooting

#### Container non parte
```bash
# Vedi i log
python start.py
# Seleziona 7) Vedi log (tutti)

# Oppure:
docker compose logs -f
```

#### Errore porta occupata
Usa l'opzione 3) Configura porte dal menu per cambiare le porte.

#### Database corrotto
```bash
# ATTENZIONE: cancella tutti i dati
docker compose down -v
python start.py up
```

#### Reset completo
```bash
docker compose down -v --rmi all
python start.py up
```

---

## License

MIT License - Vedi LICENSE file per dettagli.
