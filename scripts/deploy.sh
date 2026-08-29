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

echo -e "${YELLOW}[1/6] Pre-flight checks...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker not installed. Installing...${NC}"
  curl -fsSL https://get.docker.com | sudo sh
fi

if [[ ! -f .env ]]; then
  echo -e "${RED}.env not found. Copy .env.example to .env and fill in values.${NC}"
  exit 1
fi

echo -e "${YELLOW}[2/6] Backing up database...${NC}"
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

echo -e "${YELLOW}[3/6] Pulling latest code...${NC}"
git stash
git pull origin master
git stash pop 2>/dev/null || true

echo -e "${YELLOW}[4/6] Ensuring proxy_network exists...${NC}"
if ! sudo docker network inspect proxy_network &>/dev/null; then
  sudo docker network create proxy_network
fi

echo -e "${YELLOW}[5/6] Building and starting containers...${NC}"
sudo docker compose down
sudo docker compose up -d --build

echo "Waiting for containers to initialize..."
sleep 10

echo -e "${YELLOW}[6/6] Running database migrations and health check...${NC}"
sudo docker compose exec -T bot npx prisma migrate deploy

HTTP_CODE=$(sudo docker compose exec -T bot curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}Bot is healthy.${NC}"
else
  echo -e "${RED}Health check failed (status: $HTTP_CODE). Check logs: docker compose logs bot${NC}"
fi

echo -e "${GREEN}=== Deployment Complete ===${NC}"
DOMAIN=$(grep '^WEBHOOK_DOMAIN=' .env | cut -d= -f2)
echo "Test: curl -I https://${DOMAIN}/health"
