# CLAUDE.md — HMS (Home Management System)

> Leggi questo file all'inizio di ogni sessione su questo progetto.

## Cos'è
Home Management System — meal planner, gestione dispensa, integrazione Home Assistant.

## Stack
- **Frontend**: React 18 + TypeScript + Vite — porta 3000
- **Backend**: Python 3.11 + FastAPI — porta 8000
- **DB**: PostgreSQL 14 (JSONB)
- **Auth**: JWT (access + refresh)
- **Real-time**: MQTT (integrazione HA)
- **Deploy**: Docker Compose su NAS

## Integrazioni esterne
- Grocy API (gestione dispensa)
- Home Assistant (MQTT)
- LLM per ricette AI

## Struttura
```
HMS/
├── frontend/     # React + Vite
├── backend/      # FastAPI
└── docker-compose.yml
```

## Riferimenti
- `SPEC.md` — specifica tecnica completa
- `DEVELOPMENT_LOG.md` — log sviluppo
- `backend/GROCY_INTEGRATION.md` — integrazione Grocy
- `backend/RECIPE_AI_NOTES.md` — note AI ricette
