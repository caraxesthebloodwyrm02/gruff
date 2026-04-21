FROM node:22-slim AS builder

WORKDIR /app

# Install system dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-slim

WORKDIR /app

# Install system dependencies for better-sqlite3 at runtime if needed
# (usually better-sqlite3 bundles prebuilds, but it's safer to have them if building from source)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/schemas ./schemas
COPY --from=builder /app/templates ./templates

# Create data directories
RUN mkdir -p /root/.echoes /root/.gruff

# The ingester expects AUDIT_PATH at ~/.echoes/audit.ndjson
# and GRUFF_DIR at ~/.gruff
ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/trust/ingester.js", "--watch"]
