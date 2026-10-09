# HMS (Home Management System) — Project Analysis

## 📊 Riepilogo Esecutivo

Nel HomeLab ci sono **84 cartelle totali** di cui:
- **1 cartella principale HMS** (il progetto)
- **5 sottocartelle interne di HMS**
- **6 progetti correlati** che si integrano con HMS
- **Nessun backup dedicato di HMS** (backups gestiti via Docker)

---

## 🎯 HMS - Il Progetto Principale

### Cos'è
**Home Management System** — Sistema intelligente di meal planning e gestione dispensa multutente.

### Percorso
`/Users/gimmidefranceschi/HomeLab/HMS/`

### Stack Tecnologico
- **Frontend**: React 18 + TypeScript + Vite (porta 3000)
- **Backend**: Python 3.11 + FastAPI (porta 8000)
- **Database**: PostgreSQL 14 con supporto JSONB
- **Autenticazione**: JWT (access + refresh tokens)
- **Real-time**: MQTT per integrazione Home Assistant
- **Infrastruttura**: Docker Compose su NAS

### Integrazioni Esterne
- 🥬 **Grocy API** — gestione dispensa
- 🏠 **Home Assistant** — automazioni domotiche
- 🧠 **LLM** — generazione ricette AI

---

## 🏗️ Struttura Interna di HMS

### Sottocartelle Principali

| Cartella | Ruolo |
|----------|-------|
| **backend/** | FastAPI, logica business, OCR |
| **frontend/** | React UI, dashboard meal planner |
| **ocr-service/** | Servizio OCR per lettura ricette |
| **docs/** | Documentazione tecnica |
| **scripts/** | Script utilità (setup, deploy) |

### File di Configurazione Chiave
- `docker-compose.yml` — orchestrazione container
- `.env` — variabili d'ambiente (secrets)
- `SPEC.md` — specifica tecnica completa
- `DEVELOPMENT_LOG.md` — storico sviluppo
- `README.md` — istruzioni avvio

---

## 🔗 Progetti Correlati (Integrazione)

Questi 6 progetti si **integrano o dipendono da HMS**:

### 1. **hass** → Home Assistant Core
   - Automazioni domotiche
   - Gestione dispositivi smart
   - Comunicazione MQTT con HMS

### 2. **ha-frontend** → Home Assistant Dashboard
   - Smart home dashboard React
   - Architettura 3-tier
   - Consuma dati da HMS

### 3. **ha-stack** → Home Assistant Stack Condiviso
   - Librerie condivise per integrazione HA
   - Configurazione comune per tutti i servizi

### 4. **portal** → Punto di Accesso Unificato
   - Aggregatore centrale di servizi
   - Accesso a HMS + altri servizi
   - Single sign-on

### 5. **manage** → Gestione Finanziaria
   - Dashboard dati finanziari
   - Consumabile da altri frontend
   - Potrebbe tracciare spese alimentari

### 6. **bottopia** → Monitor Agenti AI
   - Monitora lo stato di tutti gli agenti IA dell'ecosistema
   - Potrebbe supervisare HMS

---

## 🧊 Progetti Correlati per Dominio

Sebbene **non integrino direttamente** con HMS:

### **fridge-dm-tracker**
Gestione frigorifero con lettore DataMatrix
- Traccia entrata/uscita prodotti
- Pesatura automatica
- Potenziale future integrazione con HMS per sincronizzazione dispensa

---

## 📈 Statistiche Cartelle HomeLab

```
Total folders:        84
HMS project:          1
HMS subfolders:       5
Related projects:     6
Other projects:       72
Backups (non-HMS):    2 (crm2-backups-vps, docker-migration-backups)
```

---

## 🚀 Come Avviare HMS

```bash
cd /Users/gimmidefranceschi/HomeLab/HMS

# Menu interattivo
./start.sh

# O via Python
python3 start.py up

# Con porte personalizzate
python3 start.py up -f 3001 -b 8001
```

---

## 📚 Documentazione Centrale

Nella root `/HMS`:
- **README.md** — Quick start
- **SPEC.md** — Specifica tecnica
- **DEVELOPMENT_LOG.md** — Storico cambiamenti
- **CLAUDE.md** — Istruzioni per Claude Code
- **HMS-IMPROVEMENTS.md** — Roadmap miglioramenti
- **TODO-RICETTE-UX.md** — Task UI ricette

---

## 🔍 Conclusione

**HMS è il progetto principale di gestione alimentare/meal planning** dell'HomeLab, con una **architettura modulare** che si integra con il resto dell'ecosistema via:
- ✅ Home Assistant (MQTT)
- ✅ Portal (aggregazione servizi)
- ✅ Database condiviso PostgreSQL
- ✅ Potenziale integrazione fridge-dm-tracker (future)

**Il progetto è autonomo** (ha la sua cartella, git, docker-compose) ma **pensato per collegarsi** agli altri nodi dell'ecosistema quando necessario.
