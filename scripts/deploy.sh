#!/bin/bash
# Slaydbot Production Deployment Script
# Run on server: bash scripts/deploy.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}=== Slaydbot Deployment ===${NC}"

echo -e "${YELLOW}[1/7] Pre-flight checks...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker not installed. Installing...${NC}"
  curl -fsSL https://get.docker.com | sudo sh
fi

if [[ ! -f .env ]]; then
  echo -e "${RED}.env not found. Copy .env.example to .env and fill in values.${NC}"
  exit 1
fi

if ! grep -q '^WEBHOOK_SECRET=.\+' .env; then
  NEW_WEBHOOK_SECRET=$(openssl rand -hex 32)
  if grep -q '^WEBHOOK_SECRET=' .env; then
    sed -i "s|^WEBHOOK_SECRET=.*|WEBHOOK_SECRET=${NEW_WEBHOOK_SECRET}|" .env
  else
    echo "WEBHOOK_SECRET=${NEW_WEBHOOK_SECRET}" >> .env
  fi
  echo -e "${GREEN}WEBHOOK_SECRET was empty - generated one automatically.${NC}"
fi

echo -e "${YELLOW}[2/7] Backing up database...${NC}"
mkdir -p backups
if sudo docker ps --format '{{.Names}}' | grep -q 'slaydbot_db'; then
  BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
  DB_USER_VALUE=$(grep '^DB_USER=' .env | cut -d= -f2)
  DB_NAME_VALUE=$(grep '^DB_NAME=' .env | cut -d= -f2)
  sudo docker exec slaydbot_db pg_dump -U "$DB_USER_VALUE" "$DB_NAME_VALUE" \
    | gzip > "backups/${BACKUP_NAME}.sql.gz" \
    && echo -e "${GREEN}Backup created: backups/${BACKUP_NAME}.sql.gz${NC}" \
    || echo -e "${YELLOW}Backup skipped (db not ready yet)${NC}"
else
  echo -e "${YELLOW}Backup skipped (container not running)${NC}"
fi

echo -e "${YELLOW}[3/7] Pulling latest code...${NC}"
git stash
git pull origin master
git stash pop 2>/dev/null || true

echo -e "${YELLOW}[4/7] Ensuring proxy_network exists...${NC}"
if ! sudo docker network inspect proxy_network &>/dev/null; then
  sudo docker network create proxy_network
fi

echo -e "${YELLOW}[5/7] Building images...${NC}"
sudo docker compose down
sudo docker compose build

# Migrations must run BEFORE the bot service starts: the bot's own startup
# (main() -> ensureSuperAdmin()) queries the User table immediately, and on
# a fresh/un-migrated database that query fails, the container crashes,
# restart:on-failure retries a few times then gives up - at which point
# "docker compose exec bot ..." can no longer reach it ("service bot is
# not running"). Running migrations via `compose run` first (a one-off
# container, not the long-running "bot" service) sidesteps that entirely -
# `run` still honors db's `depends_on: condition: service_healthy`.
echo -e "${YELLOW}[6/7] Running database migrations...${NC}"
sudo docker compose run --rm -T bot npx prisma migrate deploy

echo -e "${YELLOW}[7/7] Starting containers and checking health...${NC}"
sudo docker compose up -d

echo "Waiting for containers to initialize..."
sleep 10

HTTP_CODE=$(sudo docker compose exec -T bot curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}Bot is healthy.${NC}"
else
  echo -e "${RED}Health check failed (status: $HTTP_CODE). Check logs: docker compose logs bot${NC}"
fi

echo -e "${GREEN}=== Deployment Complete ===${NC}"
DOMAIN=$(grep '^WEBHOOK_DOMAIN=' .env | cut -d= -f2)
echo "Test: curl -I https://${DOMAIN}/health"
