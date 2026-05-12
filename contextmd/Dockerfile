# ── ContextMD Cloud Run Dockerfile ────────────────────────────────────────────
# One image, 6 Cloud Run services.
# Each service sets AGENT_ENTRYPOINT, e.g. "orchestrator/server.ts"

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV PORT=8080
ENV NODE_ENV=production

# Shell form so $AGENT_ENTRYPOINT is expanded at runtime from the service env var
CMD sh -c "npx tsx ${AGENT_ENTRYPOINT:-orchestrator/server.ts}"
