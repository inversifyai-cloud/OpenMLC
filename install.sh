#!/usr/bin/env bash

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

step()  { printf "${GREEN}▸${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$1"; }
fail()  { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }
ask()   { printf "${BOLD}?${NC} %s " "$1"; }

REPO_RAW="https://raw.githubusercontent.com/inversifyai-cloud/OpenMLC/main"
INSTALL_DIR="${OPENMLC_DIR:-$HOME/openmlc}"

cat <<'BANNER'
   ___                   __  __ _    ___
  / _ \ _ __  ___ _ _   |  \/  | |  / __|
 | (_) | '_ \/ -_) ' \  | |\/| | |_| (__
  \___/| .__/\___|_||_| |_|  |_|____\___|
       |_|

  self-hosted, byok ai chat — installer

BANNER

command -v docker >/dev/null 2>&1 \
  || fail "docker is not installed. install it first: https://docs.docker.com/get-docker/"

if ! docker compose version >/dev/null 2>&1; then
  command -v docker-compose >/dev/null 2>&1 \
    || fail "docker compose is not installed. install Docker Desktop or the compose plugin."
fi

if ! command -v openssl >/dev/null 2>&1; then
  fail "openssl is required to generate secrets. install it (brew install openssl / apt install openssl) and re-run."
fi

step "docker + openssl found"

echo
if [ -d "$INSTALL_DIR" ]; then
  warn "directory $INSTALL_DIR already exists."
  ask "overwrite the docker-compose.yml + .env in there? (y/N):"
  read -r OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    fail "aborted. either remove $INSTALL_DIR or set OPENMLC_DIR=/some/other/path and re-run."
  fi
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
step "using install dir: $INSTALL_DIR"

step "downloading docker-compose.yml…"
curl -sSL -o docker-compose.yml "$REPO_RAW/docker-compose.yml" \
  || fail "could not download docker-compose.yml from $REPO_RAW"

step "generating session + encryption secrets…"
SESSION_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

cat > .env <<EOF

SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

EOF

chmod 600 .env
step "wrote .env (mode 0600)"

step "pulling image (first run can take a minute)…"
docker compose pull 2>&1 || fail "image pull failed — see error above."

step "starting openmlc…"
docker compose up -d >/dev/null 2>&1 || fail "docker compose up failed. run \`docker compose logs\` in $INSTALL_DIR to see why."

step "waiting for the server to come up…"
for i in {1..30}; do
  if curl -fs -o /dev/null http://localhost:3000/api/models 2>/dev/null; then
    READY=1
    break
  fi
  sleep 1
done

echo
if [ "${READY:-0}" = "1" ]; then
  printf "${GREEN}${BOLD}✓ openmlc is live${NC}\n"
  echo
  printf "  ${BOLD}→${NC} open ${BOLD}http://localhost:3000${NC} in your browser\n"
  echo
  printf "  ${DIM}install dir:    ${NC}$INSTALL_DIR\n"
  printf "  ${DIM}view logs:      ${NC}cd $INSTALL_DIR && docker compose logs -f\n"
  printf "  ${DIM}stop:           ${NC}cd $INSTALL_DIR && docker compose down\n"
  printf "  ${DIM}update:         ${NC}cd $INSTALL_DIR && docker compose pull && docker compose up -d\n"
  echo
  printf "  ${DIM}your data lives in named docker volumes (openmlc-data + openmlc-uploads).${NC}\n"
  printf "  ${DIM}don't run 'docker compose down -v' — that wipes them.${NC}\n"
  echo
else
  warn "container started but the server didn't respond on :3000 in 30s."
  warn "check logs with: cd $INSTALL_DIR && docker compose logs -f"
fi
