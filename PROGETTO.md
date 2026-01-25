# Meal Planner - Stato del Progetto

## Documenti

| File | Descrizione |
|------|-------------|
| `SPEC.md` | Specifica tecnica completa (architettura, DB, API, flussi) |
| `../nutrizione_pulito.csv` | Database 192 alimenti con macro/micro nutrienti |

---

## Decisioni Prese

### Stack Tecnologico

| Layer | Tecnologia | Motivazione |
|-------|------------|-------------|
| **Frontend** | React 18 + TypeScript + Vite | Ecosystem maturo, type-safe |
| **Backend** | Python 3.11 + FastAPI | Async, Pydantic, facile integrazione LLM |
| **Database** | PostgreSQL 14 | JSONB per flessibilità, multi-tenant |
| **Auth** | JWT (access + refresh) | Stateless, scalabile |
| **Real-time** | MQTT | Integrazione nativa con Home Assistant |
| **Deploy** | Docker Compose su NAS | Self-hosted |

### Architettura

```
┌─────────────────────────────────────────────────┐
│            FRONTEND (React + TS)                │
│  :3000                                          │
└──────────────────────┬──────────────────────────┘
                       │ REST API
          ┌────────────▼────────────┐
          │  BACKEND (FastAPI)      │
          │  :8000                  │
          └──┬────────┬─────────┬───┘
             │        │         │
     ┌───────▼──┐ ┌───▼───┐ ┌───▼────┐
     │PostgreSQL│ │ MQTT  │ │ Grocy  │
     │  :5432   │ │ (HA)  │ │  API   │
     └──────────┘ └───────┘ └────────┘
```

### Modello Dati Principale

- **Users**: account con preferenze
- **Houses**: nuclei familiari (multi-tenant)
- **Recipes**: ricette con ingredienti (JSONB)
- **Meals**: pasti consumati con tracking nutrizionale
- **Foods**: 192 alimenti base (dal CSV)
- **Weights/Health**: tracking salute

---

## Funzionalità MVP

- [x] Spec completa
- [ ] Auth multi-utente (register, login, JWT)
- [ ] Sistema case con inviti (codice 6 char)
- [ ] CRUD ricette con calcolo nutrienti automatico
- [ ] Registrazione pasti (da ricetta o ad-hoc)
- [ ] Integrazione Grocy (lettura inventario)
- [ ] Tracking peso
- [ ] Dashboard riepilogativa

---

## Integrazioni

| Sistema | Stato | Tipo |
|---------|-------|------|
| Grocy | Da implementare | REST API (lettura stock) |
| Home Assistant | Da implementare | MQTT publisher |
| OpenWebUI (LLM) | Fase 2 | Suggerimenti intelligenti |
| n8n | Fase 2 | Automazioni, notifiche |
| Telegram | Fase 2 | Bot notifiche |

---

## Informazioni da Fornire

Prima di iniziare lo sviluppo, servono:

```
GROCY:
- URL: _______________
- API Key: _______________
- Port: _______________

HOME ASSISTANT:
- URL: _______________
- MQTT Broker: SI/NO
- MQTT Port: _______________
- MQTT Credentials: _______________

DOCKER/NAS:
- Tipo NAS: _______________
- Docker version: _______________

PORTS:
- Frontend: 3000 (default)
- Backend: 8000 (default)
- PostgreSQL: 5432 (internal)
```

---

## Prossimi Step

1. Completare le informazioni mancanti (Grocy, MQTT)
2. Inizializzare struttura progetto
3. Setup Docker Compose
4. Implementare backend (auth → houses → foods → recipes → meals)
5. Implementare frontend
6. Integrare Grocy
7. Test e deploy

---

*Ultimo aggiornamento: 2026-01-13*
