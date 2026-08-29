# --- Stage 1: build ---
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# prisma.config.ts is required by Prisma 7's config loader (it does
# `import "dotenv/config"` and reads `env("DATABASE_URL")` via @prisma/config,
# which throws PrismaConfigEnvError if DATABASE_URL is unset). `prisma generate`
# never connects to a database, so a dummy value is enough to satisfy the
# config loader for this build-time step only.
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# node:20-slim already ships a non-root "node" user (uid/gid 1000) -
# creating our own appuser at uid 1000 collides with it ("UID 1000 is
# not unique"), so we reuse the image's built-in user instead.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY package.json ./

RUN chown -R node:node /app
USER node

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/index.js"]
