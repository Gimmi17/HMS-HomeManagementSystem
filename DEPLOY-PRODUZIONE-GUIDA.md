# Guida al Deploy in Produzione - HMS

## Panoramica del Flusso

```
[Sviluppo Locale] → [GitHub] → [GitHub Actions] → [Docker Hub] → [NAS UGREEN]
```

## Step 1: Push su GitHub

Quando fai `git push origin main`, il codice viene caricato su GitHub.

```bash
git add .
git commit -m "Descrizione delle modifiche"
git push origin main
```

## Step 2: GitHub Actions (Automatico)

Il file `.github/workflows/build-and-push.yml` si attiva automaticamente ad ogni push su `main`.

**Cosa fa:**
1. Clona il repository
2. Builda l'immagine Docker del **backend** da `backend/Dockerfile`
3. Builda l'immagine Docker del **frontend** da `frontend/Dockerfile`
4. Pusha entrambe le immagini su Docker Hub

**Immagini create:**
- `gimmi17/hms-backend:latest`
- `gimmi17/hms-frontend:latest`

**Verifica lo stato:**
- Vai su: https://github.com/Gimmi17/HMS-HomeManagementSystem/actions
- Aspetta che il workflow diventi verde (completato)

## Step 3: Deploy su NAS UGREEN

Una volta che GitHub Actions ha completato:

1. Apri il tool di gestione Docker su UGREEN
2. Vai al progetto **HMS2**
3. Fai **Redeploy** o **Aggiorna**
4. Il NAS pullerà le nuove immagini da Docker Hub

**Importante:** Il NAS usa `docker-compose.prod.yml` che specifica:
```yaml
backend:
  image: gimmi17/hms-backend:latest

frontend:
  image: gimmi17/hms-frontend:latest
```

## Struttura dei File

```
meal-planner2/
├── .github/
│   └── workflows/
│       └── build-and-push.yml    # GitHub Action per build automatico
├── backend/
│   └── Dockerfile                 # Dockerfile per il backend Python
├── frontend/
│   └── Dockerfile                 # Dockerfile per il frontend React
└── docker-compose.prod.yml        # Compose per produzione (usa immagini da Docker Hub)
```

## Risoluzione Problemi

### Il NAS non vede le nuove modifiche
1. Verifica che GitHub Actions sia completato (verde)
2. Sul NAS, elimina i container `hms-frontend` e `hms-backend`
3. Elimina le immagini vecchie dalla sezione "Immagini"
4. Rideploya - forzerà il pull delle nuove immagini

### Errore SSL sul frontend
Il frontend usa `nginx.prod.conf` che è solo HTTP (porta 3000).
Se vedi errori SSL, l'immagine vecchia è in cache - elimina e ripulla.

### Database "meal_planner" does not exist
È un warning dell'healthcheck, non un errore critico.
Il database corretto è `meal_planner_db` e funziona.

## Porte di Produzione

| Servizio | Porta Interna | Porta Esterna |
|----------|---------------|---------------|
| Frontend | 3000          | 5052          |
| Backend  | 8000          | 8847          |
| Postgres | 5432          | (interna)     |

**URL di accesso:** `http://192.168.1.22:5052`

## Note

- **NON** eliminare il container `hms-db` o il volume `hms_postgres_data` - contengono i dati!
- Il build avviene su GitHub (cloud), non sul NAS
- Le immagini sono pubbliche su Docker Hub
