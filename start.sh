#!/usr/bin/env bash
# start.sh — lokaler Thaddeus-Stack (Podman)
#
# Startet alle Komponenten in der richtigen Reihenfolge.
# Bestehende Container werden wiederverwendet; fehlende werden neu erstellt.
#
# Services nach dem Start:
#   Keycloak          http://localhost:8080  (admin / admin)
#   Thaddeus Server   http://localhost:8081
#   Thaddeus UI       http://localhost:3000  (login: admin / admin)
#   Mock Agent        (optional, für IIS-Simulation)
#
# Voraussetzungen: podman, podman-compose (oder docker + docker-compose)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[thaddeus]${NC} $*"; }
warn() { echo -e "${YELLOW}[thaddeus]${NC} $*"; }
die()  { echo -e "${RED}[thaddeus] ERROR:${NC} $*" >&2; exit 1; }

command -v podman &>/dev/null || die "podman not found"

# ── helpers ──────────────────────────────────────────────────────────────────

container_running() { podman ps -q --filter "name=^$1\$" | grep -q .; }
container_exists()  { podman ps -aq --filter "name=^$1\$" | grep -q .; }

wait_http() {
  local url=$1 label=$2
  log "Waiting for $label ($url)..."
  until curl -sf "$url" > /dev/null 2>&1; do sleep 3; done
  log "$label ready"
}

# ── PostgreSQL ────────────────────────────────────────────────────────────────

if ! container_running "thaddeus_postgres_1" && ! container_running "thaddeus-postgres"; then
  log "Starting PostgreSQL..."
  if container_exists "thaddeus_postgres_1"; then
    podman start thaddeus_postgres_1
  elif container_exists "thaddeus-postgres"; then
    podman start thaddeus-postgres
  else
    podman run -d --name thaddeus_postgres_1 \
      -p 5432:5432 \
      -e POSTGRES_DB=thaddeus \
      -e POSTGRES_USER=thaddeus \
      -e POSTGRES_PASSWORD=thaddeus \
      -v thaddeus_postgres_data:/var/lib/postgresql/data \
      postgres:16-alpine
  fi
else
  log "PostgreSQL already running"
fi

until podman exec thaddeus_postgres_1 pg_isready -U thaddeus &>/dev/null \
   || podman exec thaddeus-postgres pg_isready -U thaddeus &>/dev/null; do
  sleep 2
done
log "PostgreSQL ready"

# Keycloak benötigt eine eigene DB
PG_CONTAINER=$(podman ps -q --filter "name=thaddeus_postgres_1" --filter "name=thaddeus-postgres" | head -1)
podman exec "$PG_CONTAINER" psql -U thaddeus -c \
  "SELECT 1 FROM pg_database WHERE datname='keycloak'" 2>/dev/null \
  | grep -q "1 row" || podman exec "$PG_CONTAINER" psql -U thaddeus -c "
    CREATE USER keycloak_user WITH PASSWORD 'supersecret';
    CREATE DATABASE keycloak OWNER keycloak_user;
  " 2>/dev/null || true

# ── Keycloak ──────────────────────────────────────────────────────────────────
# KC_HOSTNAME_STRICT=false → Keycloak nutzt den Request-Host als Issuer.
# Das ist nötig, damit Browser-Tokens (localhost:8080) und Container-Tokens
# (host.containers.internal:8080) beide valide sind.
# Der Server akzeptiert beliebige Issuer via QUARKUS_OIDC_TOKEN_ISSUER=any.

if ! container_running "keycloak"; then
  log "Starting Keycloak..."
  if container_exists "keycloak"; then
    podman start keycloak
  else
    podman run -d --name keycloak \
      -p 8080:8080 \
      -e KEYCLOAK_ADMIN=admin \
      -e KEYCLOAK_ADMIN_PASSWORD=admin \
      -e KC_DB=postgres \
      -e KC_DB_URL=jdbc:postgresql://host.containers.internal:5432/keycloak \
      -e KC_DB_USERNAME=keycloak_user \
      -e KC_DB_PASSWORD=supersecret \
      -e KC_HTTP_ENABLED=true \
      -e KC_HOSTNAME_STRICT=false \
      -v "$SCRIPT_DIR/deploy/keycloak:/opt/keycloak/data/import:z" \
      quay.io/keycloak/keycloak:26.6.3 start-dev --import-realm
  fi
else
  log "Keycloak already running"
fi

wait_http "http://localhost:8080/realms/thaddeus/.well-known/openid-configuration" "Keycloak"

# ── Thaddeus Server ───────────────────────────────────────────────────────────
# Wichtige Env-Vars:
#   QUARKUS_OIDC_TOKEN_ISSUER=any       → akzeptiert tokens von localhost UND
#                                         host.containers.internal (beide Issuer)
#   QUARKUS_OIDC_ROLES_ROLE_CLAIM_PATH  → Rollen aus realm_access.roles lesen
#
# Das Image wird bei Bedarf gebaut (Build-Kontext: Projekt-Root,
# Dockerfile: thaddeus-server/Dockerfile).

log "Building thaddeus-server image..."
podman build -t localhost/thaddeus_thaddeus-server:latest \
  -f thaddeus-server/Dockerfile \
  . 2>&1 | tail -5

if container_exists "thaddeus-server"; then
  podman stop thaddeus-server 2>/dev/null || true
  podman rm thaddeus-server
fi

log "Starting thaddeus-server..."
podman run -d --name thaddeus-server \
  -p 8081:8080 \
  -e DB_URL=jdbc:postgresql://host.containers.internal:5432/thaddeus \
  -e DB_USER=thaddeus \
  -e DB_PASSWORD=thaddeus \
  -e OIDC_ISSUER_URL=http://host.containers.internal:8080/realms/thaddeus \
  -e OIDC_CLIENT_ID=thaddeus-server \
  -e OIDC_CLIENT_SECRET=thaddeus-server-secret \
  -e QUARKUS_OIDC_TOKEN_ISSUER=any \
  -e QUARKUS_OIDC_ROLES_ROLE_CLAIM_PATH=realm_access/roles \
  -e PACKAGES_ROOT=/var/thaddeus/packages \
  -v thaddeus_packages:/var/thaddeus/packages \
  localhost/thaddeus_thaddeus-server:latest

wait_http "http://localhost:8081/q/health/ready" "Thaddeus Server"

# ── Thaddeus UI ───────────────────────────────────────────────────────────────

log "Building thaddeus-ui image..."
podman build -t localhost/thaddeus_thaddeus-ui:latest \
  ./thaddeus-ui 2>&1 | tail -5

if container_exists "thaddeus-ui"; then
  podman stop thaddeus-ui 2>/dev/null || true
  podman rm thaddeus-ui
fi

log "Starting thaddeus-ui..."
podman run -d --name thaddeus-ui \
  -p 3000:80 \
  localhost/thaddeus_thaddeus-ui:latest

wait_http "http://localhost:3000" "Thaddeus UI"

# ── Mock Agent (optional) ─────────────────────────────────────────────────────

if [[ "${1:-}" == "--with-mock-agent" ]]; then
  log "Building mock-agent image..."
  podman build -t localhost/thaddeus_mock-agent:latest \
    -f deploy/mock-agent/Dockerfile \
    . 2>&1 | tail -5

  if container_exists "thaddeus-mock-agent"; then
    podman stop thaddeus-mock-agent 2>/dev/null || true
    podman rm thaddeus-mock-agent
  fi

  log "Starting mock-agent..."
  podman run -d --name thaddeus-mock-agent \
    -e THADDEUS_SERVER_URL=http://host.containers.internal:8081 \
    -e OIDC_ISSUER_URL=http://host.containers.internal:8080/realms/thaddeus \
    -e OIDC_CLIENT_ID=thaddeus-agent \
    -e OIDC_CLIENT_SECRET=thaddeus-agent-secret \
    localhost/thaddeus_mock-agent:latest

  log "Mock agent started (simulates Windows/IIS target)"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Thaddeus läuft lokal                         ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  UI       http://localhost:3000                      ║${NC}"
echo -e "${GREEN}║           Login: admin / admin                       ║${NC}"
echo -e "${GREEN}║  Server   http://localhost:8081                      ║${NC}"
echo -e "${GREEN}║  Keycloak http://localhost:8080  (admin / admin)     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
if [[ "${1:-}" != "--with-mock-agent" ]]; then
  echo -e "  Mock Agent (IIS-Simulation): ${YELLOW}./start.sh --with-mock-agent${NC}"
  echo ""
fi
