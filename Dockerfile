# syntax=docker/dockerfile:1
#
# One image that serves the UI and the API on a single port. It runs unchanged
# on Hugging Face Spaces, Render, Fly, Koyeb, or any VPS with Docker.
#
# The only real requirement is an FFmpeg built with libzimg, because the whole
# tone-mapping chain depends on the zscale filter. Debian's ffmpeg package has
# it; the server verifies this at boot and says so loudly if it is missing.

# ── Stage 1: build the frontend ──────────────────────────────────────────────
FROM node:22-bookworm-slim AS frontend

WORKDIR /build

# Copy manifests first so this layer is cached until a dependency actually
# changes, rather than on every source edit.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend && npm cache clean --force

COPY backend/ ./backend/
COPY --from=frontend /build/dist ./frontend/dist

# Uploads and outputs are transient by design, so they live outside the app
# directory and are owned by the unprivileged user the process runs as.
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app

# Nothing here needs root. If the encoder is ever tricked into doing something
# unexpected, it does it as a user that owns almost nothing.
USER node

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

EXPOSE 3001

# The platform's own health check usually replaces this, but it makes `docker
# run` locally honest about whether the app came up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Node as PID 1 handles SIGTERM here because server.js installs a handler for
# it — that handler kills running encodes and wipes the working directory,
# which is what keeps the deletion promise true across a redeploy.
CMD ["node", "backend/server.js"]
