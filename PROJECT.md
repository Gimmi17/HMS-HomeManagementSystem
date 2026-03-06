# HMS (Home Management System)

## Overview
Progetto di meal planning intelligente e multi-utente. Gestisce ricette, pianificazione pasti, tracking nutrizionale e integrazione con Grocy/Home Assistant. Esistono più versioni/iterazioni nella stessa cartella.

## Stack
- **Backend:** Node.js / Python (varia per versione)
- **DB:** varia (SQLite / Postgres a seconda della versione)
- **Infrastruttura:** Docker Compose (versioni Docker disponibili)
- **Dati nutrizionali:** CSV (`nutrizione_Master_Nutrizione_UE.csv`, `nutrizione_pulito.csv`)

## Architecture
```
food/
├── hms/              # Versione 1 — con backend, README, SPEC, TASKS
├── hms2/             # Versione 2 — con Docker (dev/prod/test compose)
├── hms2-Docker/      # Variante Docker della v2
├── meal--planner3/            # Versione 3 (work in progress)
├── HMS-HomeManagementSystem/  # Estensione: sistema gestione casa completo
└── nutrizione_*.csv           # Dataset nutrizionali UE
```

## Status
WIP (sviluppo attivo su più versioni in parallelo)

## Entry Points
- Ogni sottocartella ha il proprio entry point — vedi README nelle singole versioni
- `hms2`: `docker-compose.prod.yml` per produzione

## Notes
- Più versioni coesistenti — `hms2` sembra la più matura (ha compose prod/dev/test)
- `HMS-HomeManagementSystem` è un'estensione più ampia che include il meal planner
- CSV nutrizionali condivisi tra le versioni
