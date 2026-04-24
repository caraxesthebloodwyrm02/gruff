# syntax=docker/dockerfile:1

# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Native build tools required for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage 3: Runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S gruff && \
    adduser -S gruff -u 1001 -G gruff

# Runtime native libs for sqlite
RUN apk add --no-cache libstdc++

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Data volumes for runtime artifacts
RUN mkdir -p /data/.gruff /data/.echoes && \
    chown -R gruff:gruff /data /app

ENV GRUFF_TRUST_SQLITE=/data/.gruff/trust.sqlite
ENV ECHOES_AUDIT_PATH=/data/.echoes/audit.ndjson
ENV NODE_ENV=production

USER gruff

ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]
