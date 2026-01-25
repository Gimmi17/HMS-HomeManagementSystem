#!/bin/bash

# Meal Planner - Server Control Interface
# ========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Default ports
DEFAULT_FRONTEND_PORT=3000
DEFAULT_BACKEND_PORT=8000
DEFAULT_DB_PORT=5432

# Current ports (will be set interactively or from args)
FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
BACKEND_PORT=$DEFAULT_BACKEND_PORT
DB_PORT=$DEFAULT_DB_PORT

# Project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Functions
print_header() {
    clear
    echo -e "${GREEN}"
    echo "  __  __            _   ____  _                            "
    echo " |  \/  | ___  __ _| | |  _ \| | __ _ _ __  _ __   ___ _ __ "
    echo " | |\/| |/ _ \/ _\` | | | |_) | |/ _\` | '_ \| '_ \ / _ \ '__|"
    echo " | |  | |  __/ (_| | | |  __/| | (_| | | | | | | |  __/ |   "
    echo " |_|  |_|\___|\__,_|_| |_|   |_|\__,_|_| |_|_| |_|\___|_|   "
    echo -e "${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker non trovato. Installalo prima di continuare."
        exit 1
    fi
    if ! docker info &> /dev/null; then
        print_error "Docker daemon non in esecuzione. Avvialo prima di continuare."
        exit 1
    fi
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port in use
    else
        return 0  # Port free
    fi
}

check_env() {
    if [ ! -f ".env" ]; then
        print_warning "File .env non trovato. Lo creo da .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            # Generate secrets
            if command -v openssl &> /dev/null; then
                SECRET_KEY=$(openssl rand -hex 32)
                DB_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
                sed -i.bak "s/your-super-secret-key-change-in-production/$SECRET_KEY/" .env 2>/dev/null || \
                    sed -i '' "s/your-super-secret-key-change-in-production/$SECRET_KEY/" .env
                sed -i.bak "s/your-secure-password/$DB_PASSWORD/" .env 2>/dev/null || \
                    sed -i '' "s/your-secure-password/$DB_PASSWORD/" .env
                rm -f .env.bak
            fi
            print_success "File .env creato con chiavi generate"
        else
            print_error "File .env.example non trovato!"
            exit 1
        fi
    fi
}

configure_ports() {
    echo ""
    echo -e "${BOLD}Configurazione Porte${NC}"
    echo -e "${CYAN}─────────────────────────────────────────${NC}"
    echo ""

    # Frontend port
    local port_status=""
    if check_port $DEFAULT_FRONTEND_PORT; then
        port_status="${GREEN}libera${NC}"
    else
        port_status="${RED}occupata${NC}"
    fi
    echo -e "  Frontend (default: $DEFAULT_FRONTEND_PORT) [$port_status]"
    read -p "  Porta frontend [$DEFAULT_FRONTEND_PORT]: " input_frontend
    FRONTEND_PORT=${input_frontend:-$DEFAULT_FRONTEND_PORT}

    # Check if custom port is free
    if [ "$FRONTEND_PORT" != "$DEFAULT_FRONTEND_PORT" ]; then
        if ! check_port $FRONTEND_PORT; then
            print_warning "Porta $FRONTEND_PORT occupata!"
            read -p "  Vuoi continuare comunque? (s/N): " confirm
            if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
                return 1
            fi
        fi
    fi

    # Backend port
    if check_port $DEFAULT_BACKEND_PORT; then
        port_status="${GREEN}libera${NC}"
    else
        port_status="${RED}occupata${NC}"
    fi
    echo -e "  Backend (default: $DEFAULT_BACKEND_PORT) [$port_status]"
    read -p "  Porta backend [$DEFAULT_BACKEND_PORT]: " input_backend
    BACKEND_PORT=${input_backend:-$DEFAULT_BACKEND_PORT}

    if [ "$BACKEND_PORT" != "$DEFAULT_BACKEND_PORT" ]; then
        if ! check_port $BACKEND_PORT; then
            print_warning "Porta $BACKEND_PORT occupata!"
            read -p "  Vuoi continuare comunque? (s/N): " confirm
            if [[ ! "$confirm" =~ ^[Ss]$ ]]; then
                return 1
            fi
        fi
    fi

    # Database port (only in dev mode)
    if check_port $DEFAULT_DB_PORT; then
        port_status="${GREEN}libera${NC}"
    else
        port_status="${RED}occupata${NC}"
    fi
    echo -e "  Database (default: $DEFAULT_DB_PORT) [$port_status]"
    read -p "  Porta database [$DEFAULT_DB_PORT]: " input_db
    DB_PORT=${input_db:-$DEFAULT_DB_PORT}

    echo ""
    echo -e "${CYAN}─────────────────────────────────────────${NC}"
    echo -e "  ${BOLD}Porte selezionate:${NC}"
    echo -e "    Frontend:  ${GREEN}$FRONTEND_PORT${NC}"
    echo -e "    Backend:   ${GREEN}$BACKEND_PORT${NC}"
    echo -e "    Database:  ${GREEN}$DB_PORT${NC}"
    echo -e "${CYAN}─────────────────────────────────────────${NC}"
    echo ""

    read -p "  Confermi? (S/n): " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        return 1
    fi

    return 0
}

export_ports() {
    export FRONTEND_PORT=$FRONTEND_PORT
    export BACKEND_PORT=$BACKEND_PORT
    export DB_PORT=$DB_PORT
}

get_status() {
    RUNNING=$(docker-compose ps -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RUNNING" -gt 0 ]; then
        echo -e "${GREEN}● Server attivo${NC} ($RUNNING container)"
    else
        echo -e "${RED}○ Server fermo${NC}"
    fi
}

show_menu() {
    print_header
    echo -e "  Status: $(get_status)"
    echo -e "  Porte:  Frontend=$FRONTEND_PORT | Backend=$BACKEND_PORT | DB=$DB_PORT"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}AVVIO${NC}"
    echo -e "    ${GREEN}1${NC}) Avvia server (development)"
    echo -e "    ${GREEN}2${NC}) Avvia server (production)"
    echo -e "    ${GREEN}3${NC}) Configura porte"
    echo ""
    echo -e "  ${BOLD}GESTIONE${NC}"
    echo -e "    ${YELLOW}4${NC}) Ferma server"
    echo -e "    ${YELLOW}5${NC}) Riavvia server"
    echo -e "    ${YELLOW}6${NC}) Ricostruisci container"
    echo ""
    echo -e "  ${BOLD}MONITORAGGIO${NC}"
    echo -e "    ${BLUE}7${NC}) Vedi log (tutti)"
    echo -e "    ${BLUE}8${NC}) Vedi log backend"
    echo -e "    ${BLUE}9${NC}) Vedi log frontend"
    echo -e "    ${BLUE}10${NC}) Status container"
    echo ""
    echo -e "  ${BOLD}DATABASE${NC}"
    echo -e "    ${CYAN}11${NC}) Seed database (importa alimenti)"
    echo -e "    ${CYAN}12${NC}) Backup database"
    echo -e "    ${CYAN}13${NC}) Accedi a PostgreSQL"
    echo ""
    echo -e "  ${BOLD}ALTRO${NC}"
    echo -e "    ${NC}14${NC}) Apri nel browser"
    echo -e "    ${NC}15${NC}) Mostra URL servizi"
    echo -e "    ${RED}0${NC})  Esci"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

create_docker_override() {
    # Create a temporary override file for custom ports
    cat > docker-compose.ports.yml << EOF
version: '3.8'

services:
  postgres:
    ports:
      - "${DB_PORT}:5432"

  backend:
    ports:
      - "${BACKEND_PORT}:8000"
    environment:
      - FRONTEND_URL=http://localhost:${FRONTEND_PORT}

  frontend:
    ports:
      - "${FRONTEND_PORT}:3000"
    environment:
      - VITE_API_URL=http://localhost:${BACKEND_PORT}/api/v1
EOF
}

start_dev() {
    print_status "Avvio server in modalita' development..."
    check_env
    export_ports
    create_docker_override

    docker-compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.ports.yml up -d --build
    if [ $? -eq 0 ]; then
        print_success "Server avviato!"
        echo ""
        print_status "Frontend: http://localhost:$FRONTEND_PORT"
        print_status "Backend:  http://localhost:$BACKEND_PORT"
        print_status "API Docs: http://localhost:$BACKEND_PORT/docs"
    else
        print_error "Errore durante l'avvio"
    fi
}

start_prod() {
    print_status "Avvio server in modalita' production..."
    check_env
    export_ports
    create_docker_override

    docker-compose -f docker-compose.yml -f docker-compose.ports.yml up -d --build
    if [ $? -eq 0 ]; then
        print_success "Server avviato!"
        echo ""
        print_status "Frontend: http://localhost:$FRONTEND_PORT"
        print_status "Backend:  http://localhost:$BACKEND_PORT"
    else
        print_error "Errore durante l'avvio"
    fi
}

stop_server() {
    print_status "Arresto server..."
    docker-compose down
    rm -f docker-compose.ports.yml
    print_success "Server fermato"
}

restart_server() {
    print_status "Riavvio server..."
    docker-compose restart
    print_success "Server riavviato"
}

rebuild_server() {
    print_status "Ricostruzione container..."
    docker-compose down
    docker-compose build --no-cache
    export_ports
    create_docker_override
    docker-compose -f docker-compose.yml -f docker-compose.ports.yml up -d
    print_success "Container ricostruiti e avviati"
}

show_logs() {
    echo -e "${YELLOW}Premi Ctrl+C per uscire dai log${NC}"
    sleep 1
    docker-compose logs -f
}

show_logs_backend() {
    echo -e "${YELLOW}Premi Ctrl+C per uscire dai log${NC}"
    sleep 1
    docker-compose logs -f backend
}

show_logs_frontend() {
    echo -e "${YELLOW}Premi Ctrl+C per uscire dai log${NC}"
    sleep 1
    docker-compose logs -f frontend
}

show_status() {
    echo ""
    docker-compose ps
    echo ""
}

seed_database() {
    print_status "Importazione alimenti nel database..."
    docker-compose exec backend python -m app.db.seed
    if [ $? -eq 0 ]; then
        print_success "Database popolato con 192 alimenti"
    else
        print_error "Errore durante il seed"
    fi
}

backup_database() {
    print_status "Creazione backup database..."
    if [ -f "./scripts/backup_db.sh" ]; then
        ./scripts/backup_db.sh
    else
        BACKUP_FILE="backups/meal_planner_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p backups
        docker-compose exec -T postgres pg_dump -U meal_planner meal_planner_db > "$BACKUP_FILE"
        if [ $? -eq 0 ]; then
            print_success "Backup creato: $BACKUP_FILE"
        else
            print_error "Errore durante il backup"
        fi
    fi
}

access_postgres() {
    print_status "Connessione a PostgreSQL..."
    echo -e "${YELLOW}Digita \\q per uscire${NC}"
    sleep 1
    docker-compose exec postgres psql -U meal_planner -d meal_planner_db
}

open_browser() {
    print_status "Apertura nel browser..."
    if command -v open &> /dev/null; then
        open "http://localhost:$FRONTEND_PORT"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:$FRONTEND_PORT"
    else
        print_warning "Impossibile aprire il browser automaticamente"
        print_status "Apri manualmente: http://localhost:$FRONTEND_PORT"
    fi
}

show_urls() {
    echo ""
    echo -e "${BOLD}Servizi disponibili:${NC}"
    echo ""
    echo -e "  ${GREEN}Frontend${NC}     http://localhost:$FRONTEND_PORT"
    echo -e "  ${GREEN}Backend API${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${GREEN}Swagger UI${NC}   http://localhost:$BACKEND_PORT/docs"
    echo -e "  ${GREEN}ReDoc${NC}        http://localhost:$BACKEND_PORT/redoc"
    echo -e "  ${GREEN}PostgreSQL${NC}   localhost:$DB_PORT"
    echo ""
}

show_help() {
    echo "Meal Planner - Server Control"
    echo ""
    echo "Uso: $0 [comando] [opzioni]"
    echo ""
    echo "Comandi:"
    echo "  up        Avvia server (development)"
    echo "  down      Ferma server"
    echo "  logs      Mostra log"
    echo "  status    Mostra stato container"
    echo ""
    echo "Opzioni:"
    echo "  -f, --frontend-port PORT   Porta frontend (default: 3000)"
    echo "  -b, --backend-port PORT    Porta backend (default: 8000)"
    echo "  -d, --db-port PORT         Porta database (default: 5432)"
    echo "  -h, --help                 Mostra questo messaggio"
    echo ""
    echo "Esempi:"
    echo "  $0                         # Avvia interfaccia interattiva"
    echo "  $0 up                      # Avvia con porte default"
    echo "  $0 up -f 3001 -b 8001      # Avvia con porte custom"
    echo "  $0 down                    # Ferma server"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        -b|--backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        -d|--db-port)
            DB_PORT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        up)
            check_docker
            start_dev
            exit 0
            ;;
        down)
            check_docker
            stop_server
            exit 0
            ;;
        logs)
            check_docker
            show_logs
            exit 0
            ;;
        status)
            check_docker
            show_status
            exit 0
            ;;
        *)
            print_error "Opzione non riconosciuta: $1"
            show_help
            exit 1
            ;;
    esac
done

# Interactive mode
check_docker

while true; do
    show_menu
    read -p "  Seleziona un'opzione: " choice
    echo ""

    case $choice in
        1) start_dev; read -p "Premi INVIO per continuare..." ;;
        2) start_prod; read -p "Premi INVIO per continuare..." ;;
        3) configure_ports; read -p "Premi INVIO per continuare..." ;;
        4) stop_server; read -p "Premi INVIO per continuare..." ;;
        5) restart_server; read -p "Premi INVIO per continuare..." ;;
        6) rebuild_server; read -p "Premi INVIO per continuare..." ;;
        7) show_logs ;;
        8) show_logs_backend ;;
        9) show_logs_frontend ;;
        10) show_status; read -p "Premi INVIO per continuare..." ;;
        11) seed_database; read -p "Premi INVIO per continuare..." ;;
        12) backup_database; read -p "Premi INVIO per continuare..." ;;
        13) access_postgres ;;
        14) open_browser; read -p "Premi INVIO per continuare..." ;;
        15) show_urls; read -p "Premi INVIO per continuare..." ;;
        0) echo -e "${GREEN}Arrivederci!${NC}"; rm -f docker-compose.ports.yml; exit 0 ;;
        *) print_error "Opzione non valida"; sleep 1 ;;
    esac
done
