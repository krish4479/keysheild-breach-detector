# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# KeyShield image — multi-stage, non-root, Next.js standalone output.
# Production: pin the base image by digest (node:24-bookworm-slim@sha256:...).
# Renovate/Dependabot (docker ecosystem) keeps the pin fresh. See docs/DEPLOYMENT.md.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:25-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:25-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime: minimal, non-root ──────────────────────────────────────────────
FROM node:25-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone bundle + assets. The `node` user (uid 1000) ships with the image.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Runtime data files not traced by the standalone tracer:
COPY --from=builder /app/lib/breach/offline-corpus.txt ./lib/breach/offline-corpus.txt

USER node
EXPOSE 3000
CMD ["node", "server.js"]
