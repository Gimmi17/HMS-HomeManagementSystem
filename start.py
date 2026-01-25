#!/usr/bin/env python3
"""
Meal Planner - Server Control Interface
Cross-platform (Mac, Windows, Linux)
"""

import os
import sys
import subprocess
import socket
import secrets
import string
import platform
from pathlib import Path
from typing import Optional, Tuple

# Enable ANSI colors on Windows
if platform.system() == "Windows":
    os.system("")  # Enables ANSI escape sequences in Windows terminal

# Colors
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    BOLD = "\033[1m"
    NC = "\033[0m"  # No Color

# Default ports
DEFAULT_FRONTEND_PORT = 3000
DEFAULT_BACKEND_PORT = 8000
DEFAULT_DB_PORT = 5432

# Current ports
frontend_port = DEFAULT_FRONTEND_PORT
backend_port = DEFAULT_BACKEND_PORT
db_port = DEFAULT_DB_PORT

# Project directory
PROJECT_DIR = Path(__file__).parent.resolve()


def clear_screen():
    """Clear terminal screen cross-platform."""
    os.system("cls" if platform.system() == "Windows" else "clear")


def print_header():
    """Print application header."""
    clear_screen()
    print(f"{Colors.GREEN}")
    print("  __  __            _   ____  _                            ")
    print(" |  \\/  | ___  __ _| | |  _ \\| | __ _ _ __  _ __   ___ _ __ ")
    print(" | |\\/| |/ _ \\/ _` | | | |_) | |/ _` | '_ \\| '_ \\ / _ \\ '__|")
    print(" | |  | |  __/ (_| | | |  __/| | (_| | | | | | | |  __/ |   ")
    print(" |_|  |_|\\___|\\__,_|_| |_|   |_|\\__,_|_| |_|_| |_|\\___|_|   ")
    print(f"{Colors.NC}")
    print(f"{Colors.CYAN}{'═' * 60}{Colors.NC}")
    print()


def print_status(msg: str):
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")


def print_success(msg: str):
    print(f"{Colors.GREEN}[OK]{Colors.NC} {msg}")


def print_error(msg: str):
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def print_warning(msg: str):
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {msg}")


def run_command(cmd: list, capture: bool = False, cwd: Optional[Path] = None) -> Tuple[int, str]:
    """Run a shell command and return exit code and output."""
    try:
        if capture:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=cwd or PROJECT_DIR
            )
            return result.returncode, result.stdout + result.stderr
        else:
            result = subprocess.run(cmd, cwd=cwd or PROJECT_DIR)
            return result.returncode, ""
    except FileNotFoundError:
        return 1, f"Command not found: {cmd[0]}"
    except Exception as e:
        return 1, str(e)


def check_docker() -> bool:
    """Check if Docker is installed and running."""
    # Check docker exists
    code, _ = run_command(["docker", "--version"], capture=True)
    if code != 0:
        print_error("Docker non trovato. Installalo prima di continuare.")
        return False

    # Check docker daemon is running
    code, _ = run_command(["docker", "info"], capture=True)
    if code != 0:
        print_error("Docker daemon non in esecuzione. Avvialo prima di continuare.")
        return False

    return True


def check_port(port: int) -> bool:
    """Check if a port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True  # Port is free
        except OSError:
            return False  # Port is in use


def generate_secret(length: int = 32) -> str:
    """Generate a random secret string."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def check_env():
    """Check and create .env file if needed."""
    env_file = PROJECT_DIR / ".env"
    env_example = PROJECT_DIR / ".env.example"

    if not env_file.exists():
        print_warning("File .env non trovato. Lo creo da .env.example...")

        if not env_example.exists():
            print_error("File .env.example non trovato!")
            return False

        # Read example and replace placeholders
        content = env_example.read_text()
        content = content.replace(
            "your-super-secret-key-change-in-production",
            generate_secret(64)
        )
        content = content.replace(
            "your-secure-password",
            generate_secret(16)
        )

        env_file.write_text(content)
        print_success("File .env creato con chiavi generate")

    return True


def get_docker_compose_cmd() -> list:
    """Get the appropriate docker-compose command."""
    # Try docker compose (v2) first
    code, _ = run_command(["docker", "compose", "version"], capture=True)
    if code == 0:
        return ["docker", "compose"]

    # Fall back to docker-compose (v1)
    code, _ = run_command(["docker-compose", "--version"], capture=True)
    if code == 0:
        return ["docker-compose"]

    print_error("docker-compose non trovato!")
    return []


def get_status() -> str:
    """Get current server status."""
    compose_cmd = get_docker_compose_cmd()
    if not compose_cmd:
        return f"{Colors.RED}? Errore{Colors.NC}"

    code, output = run_command(compose_cmd + ["ps", "-q"], capture=True)
    if code == 0 and output.strip():
        count = len(output.strip().split('\n'))
        return f"{Colors.GREEN}● Server attivo{Colors.NC} ({count} container)"
    else:
        return f"{Colors.RED}○ Server fermo{Colors.NC}"


def create_ports_override():
    """Create docker-compose override file for custom ports."""
    content = f"""version: '3.8'

services:
  postgres:
    ports:
      - "{db_port}:5432"

  backend:
    ports:
      - "{backend_port}:8000"
    environment:
      - FRONTEND_URL=http://localhost:{frontend_port}

  frontend:
    ports:
      - "{frontend_port}:3000"
    environment:
      - VITE_API_URL=http://localhost:{backend_port}/api/v1
"""
    (PROJECT_DIR / "docker-compose.ports.yml").write_text(content)


def configure_ports() -> bool:
    """Interactive port configuration."""
    global frontend_port, backend_port, db_port

    print()
    print(f"{Colors.BOLD}Configurazione Porte{Colors.NC}")
    print(f"{Colors.CYAN}{'─' * 45}{Colors.NC}")
    print()

    # Frontend port
    status = f"{Colors.GREEN}libera{Colors.NC}" if check_port(DEFAULT_FRONTEND_PORT) else f"{Colors.RED}occupata{Colors.NC}"
    print(f"  Frontend (default: {DEFAULT_FRONTEND_PORT}) [{status}]")
    inp = input(f"  Porta frontend [{DEFAULT_FRONTEND_PORT}]: ").strip()
    frontend_port = int(inp) if inp.isdigit() else DEFAULT_FRONTEND_PORT

    # Backend port
    status = f"{Colors.GREEN}libera{Colors.NC}" if check_port(DEFAULT_BACKEND_PORT) else f"{Colors.RED}occupata{Colors.NC}"
    print(f"  Backend (default: {DEFAULT_BACKEND_PORT}) [{status}]")
    inp = input(f"  Porta backend [{DEFAULT_BACKEND_PORT}]: ").strip()
    backend_port = int(inp) if inp.isdigit() else DEFAULT_BACKEND_PORT

    # Database port
    status = f"{Colors.GREEN}libera{Colors.NC}" if check_port(DEFAULT_DB_PORT) else f"{Colors.RED}occupata{Colors.NC}"
    print(f"  Database (default: {DEFAULT_DB_PORT}) [{status}]")
    inp = input(f"  Porta database [{DEFAULT_DB_PORT}]: ").strip()
    db_port = int(inp) if inp.isdigit() else DEFAULT_DB_PORT

    print()
    print(f"{Colors.CYAN}{'─' * 45}{Colors.NC}")
    print(f"  {Colors.BOLD}Porte selezionate:{Colors.NC}")
    print(f"    Frontend:  {Colors.GREEN}{frontend_port}{Colors.NC}")
    print(f"    Backend:   {Colors.GREEN}{backend_port}{Colors.NC}")
    print(f"    Database:  {Colors.GREEN}{db_port}{Colors.NC}")
    print(f"{Colors.CYAN}{'─' * 45}{Colors.NC}")
    print()

    confirm = input("  Confermi? (S/n): ").strip().lower()
    return confirm != 'n'


def start_dev():
    """Start server in development mode."""
    print_status("Avvio server in modalita' development...")

    if not check_env():
        return

    create_ports_override()
    compose_cmd = get_docker_compose_cmd()
    if not compose_cmd:
        return

    cmd = compose_cmd + [
        "-f", "docker-compose.yml",
        "-f", "docker-compose.dev.yml",
        "-f", "docker-compose.ports.yml",
        "up", "-d", "--build"
    ]

    code, _ = run_command(cmd)
    if code == 0:
        print_success("Server avviato!")
        print()
        print_status(f"Frontend: http://localhost:{frontend_port}")
        print_status(f"Backend:  http://localhost:{backend_port}")
        print_status(f"API Docs: http://localhost:{backend_port}/docs")
    else:
        print_error("Errore durante l'avvio")


def start_prod():
    """Start server in production mode."""
    print_status("Avvio server in modalita' production...")

    if not check_env():
        return

    create_ports_override()
    compose_cmd = get_docker_compose_cmd()
    if not compose_cmd:
        return

    cmd = compose_cmd + [
        "-f", "docker-compose.yml",
        "-f", "docker-compose.ports.yml",
        "up", "-d", "--build"
    ]

    code, _ = run_command(cmd)
    if code == 0:
        print_success("Server avviato!")
        print()
        print_status(f"Frontend: http://localhost:{frontend_port}")
        print_status(f"Backend:  http://localhost:{backend_port}")
    else:
        print_error("Errore durante l'avvio")


def stop_server():
    """Stop the server."""
    print_status("Arresto server...")
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        run_command(compose_cmd + ["down"])
        # Clean up ports override
        ports_file = PROJECT_DIR / "docker-compose.ports.yml"
        if ports_file.exists():
            ports_file.unlink()
        print_success("Server fermato")


def restart_server():
    """Restart the server."""
    print_status("Riavvio server...")
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        run_command(compose_cmd + ["restart"])
        print_success("Server riavviato")


def rebuild_server():
    """Rebuild and restart containers."""
    print_status("Ricostruzione container...")
    compose_cmd = get_docker_compose_cmd()
    if not compose_cmd:
        return

    run_command(compose_cmd + ["down"])
    run_command(compose_cmd + ["build", "--no-cache"])
    create_ports_override()
    run_command(compose_cmd + [
        "-f", "docker-compose.yml",
        "-f", "docker-compose.ports.yml",
        "up", "-d"
    ])
    print_success("Container ricostruiti e avviati")


def show_logs(service: Optional[str] = None):
    """Show logs (optionally for specific service)."""
    print(f"{Colors.YELLOW}Premi Ctrl+C per uscire dai log{Colors.NC}")
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        cmd = compose_cmd + ["logs", "-f"]
        if service:
            cmd.append(service)
        try:
            run_command(cmd)
        except KeyboardInterrupt:
            pass


def show_status():
    """Show container status."""
    print()
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        run_command(compose_cmd + ["ps"])
    print()


def seed_database():
    """Import foods into database."""
    print_status("Importazione alimenti nel database...")
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        code, _ = run_command(compose_cmd + ["exec", "backend", "python", "-m", "app.db.seed"])
        if code == 0:
            print_success("Database popolato con 192 alimenti")
        else:
            print_error("Errore durante il seed")


def backup_database():
    """Backup the database."""
    print_status("Creazione backup database...")

    from datetime import datetime
    backup_dir = PROJECT_DIR / "backups"
    backup_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"meal_planner_{timestamp}.sql"

    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        code, output = run_command(
            compose_cmd + ["exec", "-T", "postgres", "pg_dump", "-U", "meal_planner", "meal_planner_db"],
            capture=True
        )
        if code == 0:
            backup_file.write_text(output)
            print_success(f"Backup creato: {backup_file}")
        else:
            print_error("Errore durante il backup")


def access_postgres():
    """Access PostgreSQL console."""
    print_status("Connessione a PostgreSQL...")
    print(f"{Colors.YELLOW}Digita \\q per uscire{Colors.NC}")
    compose_cmd = get_docker_compose_cmd()
    if compose_cmd:
        run_command(compose_cmd + ["exec", "postgres", "psql", "-U", "meal_planner", "-d", "meal_planner_db"])


def open_browser():
    """Open frontend in browser."""
    import webbrowser
    url = f"http://localhost:{frontend_port}"
    print_status(f"Apertura {url} nel browser...")
    webbrowser.open(url)


def show_urls():
    """Show service URLs."""
    print()
    print(f"{Colors.BOLD}Servizi disponibili:{Colors.NC}")
    print()
    print(f"  {Colors.GREEN}Frontend{Colors.NC}     http://localhost:{frontend_port}")
    print(f"  {Colors.GREEN}Backend API{Colors.NC}  http://localhost:{backend_port}")
    print(f"  {Colors.GREEN}Swagger UI{Colors.NC}   http://localhost:{backend_port}/docs")
    print(f"  {Colors.GREEN}ReDoc{Colors.NC}        http://localhost:{backend_port}/redoc")
    print(f"  {Colors.GREEN}PostgreSQL{Colors.NC}   localhost:{db_port}")
    print()


def show_menu():
    """Show interactive menu."""
    print_header()
    print(f"  Status: {get_status()}")
    print(f"  Porte:  Frontend={frontend_port} | Backend={backend_port} | DB={db_port}")
    print(f"  Sistema: {platform.system()} {platform.release()}")
    print()
    print(f"{Colors.CYAN}{'═' * 60}{Colors.NC}")
    print()
    print(f"  {Colors.BOLD}AVVIO{Colors.NC}")
    print(f"    {Colors.GREEN}1{Colors.NC}) Avvia server (development)")
    print(f"    {Colors.GREEN}2{Colors.NC}) Avvia server (production)")
    print(f"    {Colors.GREEN}3{Colors.NC}) Configura porte")
    print()
    print(f"  {Colors.BOLD}GESTIONE{Colors.NC}")
    print(f"    {Colors.YELLOW}4{Colors.NC}) Ferma server")
    print(f"    {Colors.YELLOW}5{Colors.NC}) Riavvia server")
    print(f"    {Colors.YELLOW}6{Colors.NC}) Ricostruisci container")
    print()
    print(f"  {Colors.BOLD}MONITORAGGIO{Colors.NC}")
    print(f"    {Colors.BLUE}7{Colors.NC}) Vedi log (tutti)")
    print(f"    {Colors.BLUE}8{Colors.NC}) Vedi log backend")
    print(f"    {Colors.BLUE}9{Colors.NC}) Vedi log frontend")
    print(f"    {Colors.BLUE}10{Colors.NC}) Status container")
    print()
    print(f"  {Colors.BOLD}DATABASE{Colors.NC}")
    print(f"    {Colors.CYAN}11{Colors.NC}) Seed database (importa alimenti)")
    print(f"    {Colors.CYAN}12{Colors.NC}) Backup database")
    print(f"    {Colors.CYAN}13{Colors.NC}) Accedi a PostgreSQL")
    print()
    print(f"  {Colors.BOLD}ALTRO{Colors.NC}")
    print(f"    14) Apri nel browser")
    print(f"    15) Mostra URL servizi")
    print(f"    {Colors.RED}0{Colors.NC})  Esci")
    print()
    print(f"{Colors.CYAN}{'═' * 60}{Colors.NC}")
    print()


def show_help():
    """Show command line help."""
    print("Meal Planner - Server Control")
    print()
    print(f"Uso: {sys.argv[0]} [comando] [opzioni]")
    print()
    print("Comandi:")
    print("  up        Avvia server (development)")
    print("  down      Ferma server")
    print("  logs      Mostra log")
    print("  status    Mostra stato container")
    print()
    print("Opzioni:")
    print("  -f, --frontend-port PORT   Porta frontend (default: 3000)")
    print("  -b, --backend-port PORT    Porta backend (default: 8000)")
    print("  -d, --db-port PORT         Porta database (default: 5432)")
    print("  -h, --help                 Mostra questo messaggio")
    print()
    print("Esempi:")
    print(f"  {sys.argv[0]}                         # Interfaccia interattiva")
    print(f"  {sys.argv[0]} up                      # Avvia con porte default")
    print(f"  {sys.argv[0]} up -f 3001 -b 8001      # Avvia con porte custom")
    print(f"  {sys.argv[0]} down                    # Ferma server")
    print()


def parse_args():
    """Parse command line arguments."""
    global frontend_port, backend_port, db_port

    args = sys.argv[1:]
    i = 0
    command = None

    while i < len(args):
        arg = args[i]

        if arg in ("-f", "--frontend-port") and i + 1 < len(args):
            frontend_port = int(args[i + 1])
            i += 2
        elif arg in ("-b", "--backend-port") and i + 1 < len(args):
            backend_port = int(args[i + 1])
            i += 2
        elif arg in ("-d", "--db-port") and i + 1 < len(args):
            db_port = int(args[i + 1])
            i += 2
        elif arg in ("-h", "--help"):
            show_help()
            sys.exit(0)
        elif arg in ("up", "down", "logs", "status"):
            command = arg
            i += 1
        else:
            print_error(f"Opzione non riconosciuta: {arg}")
            show_help()
            sys.exit(1)

    return command


def main():
    """Main entry point."""
    global frontend_port, backend_port, db_port

    # Change to project directory
    os.chdir(PROJECT_DIR)

    # Parse command line arguments
    command = parse_args()

    # Check Docker
    if not check_docker():
        sys.exit(1)

    # Handle direct commands
    if command == "up":
        start_dev()
        sys.exit(0)
    elif command == "down":
        stop_server()
        sys.exit(0)
    elif command == "logs":
        show_logs()
        sys.exit(0)
    elif command == "status":
        show_status()
        sys.exit(0)

    # Interactive mode
    while True:
        show_menu()
        try:
            choice = input("  Seleziona un'opzione: ").strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n{Colors.GREEN}Arrivederci!{Colors.NC}")
            break

        print()

        if choice == "1":
            start_dev()
            input("Premi INVIO per continuare...")
        elif choice == "2":
            start_prod()
            input("Premi INVIO per continuare...")
        elif choice == "3":
            configure_ports()
            input("Premi INVIO per continuare...")
        elif choice == "4":
            stop_server()
            input("Premi INVIO per continuare...")
        elif choice == "5":
            restart_server()
            input("Premi INVIO per continuare...")
        elif choice == "6":
            rebuild_server()
            input("Premi INVIO per continuare...")
        elif choice == "7":
            show_logs()
        elif choice == "8":
            show_logs("backend")
        elif choice == "9":
            show_logs("frontend")
        elif choice == "10":
            show_status()
            input("Premi INVIO per continuare...")
        elif choice == "11":
            seed_database()
            input("Premi INVIO per continuare...")
        elif choice == "12":
            backup_database()
            input("Premi INVIO per continuare...")
        elif choice == "13":
            access_postgres()
        elif choice == "14":
            open_browser()
            input("Premi INVIO per continuare...")
        elif choice == "15":
            show_urls()
            input("Premi INVIO per continuare...")
        elif choice == "0":
            print(f"{Colors.GREEN}Arrivederci!{Colors.NC}")
            # Cleanup
            ports_file = PROJECT_DIR / "docker-compose.ports.yml"
            if ports_file.exists():
                ports_file.unlink()
            break
        else:
            print_error("Opzione non valida")
            input("Premi INVIO per continuare...")


if __name__ == "__main__":
    main()
