# syntax=docker/dockerfile:1
# Multi-stage build producing Next.js standalone output.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Build tools as a fallback for the better-sqlite3 native module (prebuilds
# usually cover linux-x64, but node-gyp needs these if a rebuild is required).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd -m nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Ensure the native SQLite module (and its prebuilt binary) is in the standalone tree.
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data && chown -R nextjs:nextjs /app
USER nextjs
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
