#!/usr/bin/env python3
"""
Fridge Pro - Local Development Launcher
Lance l'ensemble de l'application (Backend + Frontend + Base de données PostgreSQL)
sans nécessiter Docker.
"""

import os
import sys
import time
import socket
import signal
import shutil
import subprocess
import threading
from pathlib import Path

# Couleurs ANSI pour le terminal
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[32m"
BLUE = "\033[34m"
CYAN = "\033[36m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"

ROOT_DIR = Path(__file__).parent.resolve()
FRIDGE_DIR = ROOT_DIR / "Fridge Pro"
BACKEND_DIR = FRIDGE_DIR / "backend"
FRONTEND_DIR = FRIDGE_DIR / "frontend"

processes = []

def log(tag: str, msg: str, color: str = RESET):
    print(f"{color}{BOLD}[{tag}]{RESET} {msg}", flush=True)

def update_env_path():
    """Ajoute les chemins Homebrew et fnm / node au PATH pour être sûr de trouver node et npm."""
    current_path = os.environ.get("PATH", "")
    additional_paths = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        os.path.expanduser("~/.local/bin"),
        os.path.expanduser("~/.cargo/bin"),
    ]

    # Détecter fnm si présent
    fnm_bin = shutil.which("fnm") or "/opt/homebrew/bin/fnm"
    if os.path.exists(fnm_bin):
        try:
            res = subprocess.run([fnm_bin, "env"], capture_args=False, stdout=subprocess.PIPE, text=True, check=True)
            for line in res.stdout.splitlines():
                if "export PATH=" in line:
                    # export PATH="/Users/...:$PATH"
                    part = line.split("export PATH=")[1].strip().strip('"').replace("$PATH", "")
                    for p in part.split(":"):
                        if p and p not in additional_paths:
                            additional_paths.insert(0, p)
        except Exception:
            pass

    # Détecter répertoires multishell fnm
    fnm_multishell = os.path.expanduser("~/.local/state/fnm_multishells")
    if os.path.isdir(fnm_multishell):
        for entry in os.scandir(fnm_multishell):
            if entry.is_dir():
                bin_dir = os.path.join(entry.path, "bin")
                if os.path.isdir(bin_dir) and bin_dir not in additional_paths:
                    additional_paths.insert(0, bin_dir)

    new_path_entries = [p for p in additional_paths if os.path.isdir(p) and p not in current_path.split(":")]
    if new_path_entries:
        os.environ["PATH"] = ":".join(new_path_entries) + ":" + current_path

def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0

def check_postgres():
    """Vérifie si PostgreSQL tourne localement sur le port 5432, sinon tente de le démarrer."""
    log("POSTGRES", "Vérification de la base de données PostgreSQL...", MAGENTA)
    if is_port_in_use(5432):
        log("POSTGRES", "PostgreSQL est actif et écoute sur le port 5432. ✅", GREEN)
        return True

    log("POSTGRES", "PostgreSQL n'est pas encore démarré. Tentative de démarrage via Homebrew...", YELLOW)
    brew_bin = shutil.which("brew") or "/opt/homebrew/bin/brew"
    if os.path.exists(brew_bin):
        # Tenter brew services start postgresql@14 puis postgresql standard
        for pg_service in ["postgresql@14", "postgresql"]:
            res = subprocess.run([brew_bin, "services", "start", pg_service], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if res.returncode == 0:
                log("POSTGRES", f"Démarrage du service {pg_service}...", YELLOW)
                for _ in range(10):
                    time.sleep(0.5)
                    if is_port_in_use(5432):
                        log("POSTGRES", f"PostgreSQL ({pg_service}) est maintenant actif ! ✅", GREEN)
                        return True

    # Essayer pg_ctl si accessible
    pg_ctl = shutil.which("pg_ctl") or "/opt/homebrew/opt/postgresql@14/bin/pg_ctl"
    pg_data = "/opt/homebrew/var/postgresql@14"
    if os.path.exists(pg_ctl) and os.path.isdir(pg_data):
        log("POSTGRES", f"Démarrage direct via pg_ctl sur {pg_data}...", YELLOW)
        subprocess.run([pg_ctl, "-D", pg_data, "start"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(10):
            time.sleep(0.5)
            if is_port_in_use(5432):
                log("POSTGRES", "PostgreSQL est maintenant actif ! ✅", GREEN)
                return True

    log("POSTGRES", "⚠️ Impossible de démarrer automatiquement PostgreSQL.", RED)
    log("POSTGRES", "Vérifiez que votre base locale tourne ou lancez : brew services start postgresql@14", YELLOW)
    return False

def setup_env_files():
    """S'assure que les fichiers .env existent avec les bonnes configurations."""
    backend_env = BACKEND_DIR / ".env"
    frontend_env = FRONTEND_DIR / ".env"

    if not backend_env.exists():
        log("CONFIG", "Génération du fichier .env pour le backend...", CYAN)
        username = os.environ.get("USER", "postgres")
        backend_content = f"""# Database (Local PostgreSQL)
DATABASE_URL="postgresql://{username}@localhost:5432/fridge_pro?schema=public"

# JWT
JWT_SECRET="fridge-pro-dev-secret-key-super-secure-jwt"
JWT_EXPIRES_IN="7d"

# Google Gemini AI (optionnel, modifiable également dans le Profil utilisateur)
# GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"

# Server (Port 5001 pour éviter le conflit avec le port 5000 AirPlay sur macOS)
PORT=5001
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:3000"

# File Upload
MAX_FILE_SIZE="10485760" # 10MB
UPLOAD_DIR="uploads"
"""
        backend_env.write_text(backend_content)
        log("CONFIG", "Fichier Fridge Pro/backend/.env créé. ✅", GREEN)

    if not frontend_env.exists():
        log("CONFIG", "Génération du fichier .env pour le frontend...", CYAN)
        frontend_env.write_text("VITE_API_URL=http://localhost:5001\n")
        log("CONFIG", "Fichier Fridge Pro/frontend/.env créé. ✅", GREEN)

def ensure_dependencies():
    """Vérifie et installe les dépendances npm si nécessaire."""
    npm_bin = shutil.which("npm")
    if not npm_bin:
        log("SYSTEM", "Erreur : 'npm' n'a pas été trouvé dans le PATH.", RED)
        sys.exit(1)

    backend_modules = BACKEND_DIR / "node_modules"
    if not backend_modules.exists():
        log("BACKEND", "Installation des dépendances npm backend...", BLUE)
        subprocess.run([npm_bin, "install"], cwd=str(BACKEND_DIR), check=True)
        log("BACKEND", "Dépendances backend installées. ✅", GREEN)

    # Prisma generate
    prisma_client_dir = BACKEND_DIR / "node_modules" / ".prisma" / "client"
    if not prisma_client_dir.exists():
        log("BACKEND", "Génération du client Prisma...", BLUE)
        npx_bin = shutil.which("npx") or "npx"
        subprocess.run([npx_bin, "prisma", "generate"], cwd=str(BACKEND_DIR), check=True)

    frontend_modules = FRONTEND_DIR / "node_modules"
    if not frontend_modules.exists():
        log("FRONTEND", "Installation des dépendances npm frontend...", GREEN)
        subprocess.run([npm_bin, "install"], cwd=str(FRONTEND_DIR), check=True)
        log("FRONTEND", "Dépendances frontend installées. ✅", GREEN)

def stream_logs(process: subprocess.Popen, tag: str, color: str):
    """Lit et affiche les logs d'un sous-processus ligne par ligne."""
    try:
        for line in iter(process.stdout.readline, ""):
            if not line:
                break
            clean_line = line.rstrip()
            if clean_line:
                print(f"{color}{BOLD}[{tag}]{RESET} {clean_line}", flush=True)
    except Exception:
        pass

def shutdown(signum=None, frame=None):
    """Arrête proprement tous les sous-processus."""
    print()
    log("SYSTEM", "Arrêt de l'application Fridge Pro...", YELLOW)
    for p in processes:
        if p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                try:
                    p.terminate()
                except Exception:
                    pass
    time.sleep(0.5)
    for p in processes:
        if p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGKILL)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
    log("SYSTEM", "Application arrêtée. À bientôt ! 👋", CYAN)
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"""
{CYAN}{BOLD}================================================================={RESET}
{GREEN}{BOLD}    🥗  FRIDGE PRO - DÉMARRAGE DE L'ENVIRONNEMENT LOCAL  🥗{RESET}
{CYAN}{BOLD}================================================================={RESET}
""")

    update_env_path()
    setup_env_files()
    check_postgres()
    ensure_dependencies()

    npm_bin = shutil.which("npm")
    if not npm_bin:
        log("SYSTEM", "npm introuvable.", RED)
        sys.exit(1)

    # Démarrage Backend
    log("SYSTEM", "Démarrage du Backend (Express + TypeScript sur le port 5001)...", BLUE)
    backend_proc = subprocess.Popen(
        [npm_bin, "run", "dev"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        preexec_fn=os.setsid
    )
    processes.append(backend_proc)

    # Démarrage Frontend
    log("SYSTEM", "Démarrage du Frontend (Vite + React sur le port 3000)...", GREEN)
    frontend_proc = subprocess.Popen(
        [npm_bin, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        preexec_fn=os.setsid
    )
    processes.append(frontend_proc)

    # Threads de lecture des logs
    t_backend = threading.Thread(target=stream_logs, args=(backend_proc, "BACKEND", BLUE), daemon=True)
    t_frontend = threading.Thread(target=stream_logs, args=(frontend_proc, "FRONTEND", GREEN), daemon=True)
    t_backend.start()
    t_frontend.start()

    # Attente brève pour laisser le serveur initialiser
    time.sleep(2)

    print(f"""
{GREEN}{BOLD}✨ Application Fridge Pro opérationnelle en local !{RESET}
-----------------------------------------------------------------
  🌐 {BOLD}Frontend (Application Web){RESET} : {CYAN}http://localhost:3000{RESET}
  ⚡ {BOLD}Backend API{RESET}                : {CYAN}http://localhost:5001{RESET}
  🩺 {BOLD}API Health Check{RESET}           : {CYAN}http://localhost:5001/api/health{RESET}

{YELLOW}{BOLD}🔑 Comptes de test pré-configurés :{RESET}
  • {BOLD}demo@fridgepro.com{RESET}  (mdp: {BOLD}demo123{RESET})  -> Profil avec inventaire
  • {BOLD}test@fridgepro.com{RESET}  (mdp: {BOLD}test123{RESET})
  • {BOLD}admin@fridgepro.com{RESET} (mdp: {BOLD}admin123{RESET})

  {MAGENTA}Appuyez sur {BOLD}Ctrl + C{RESET}{MAGENTA} à tout moment pour arrêter l'application.{RESET}
-----------------------------------------------------------------
""")

    # Boucle de surveillance
    try:
        while True:
            time.sleep(1)
            # Vérifier si l'un des sous-processus est mort inopinément
            if backend_proc.poll() is not None:
                log("BACKEND", f"Le backend s'est arrêté avec le code {backend_proc.poll()}", RED)
                break
            if frontend_proc.poll() is not None:
                log("FRONTEND", f"Le frontend s'est arrêté avec le code {frontend_proc.poll()}", RED)
                break
    except KeyboardInterrupt:
        pass
    finally:
        shutdown()

if __name__ == "__main__":
    main()
