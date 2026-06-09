# agent-os: worker + control-plane HTTP/SSE server.
# NOTE: not built in this environment (the Docker registry is blocked); the build
# steps (npm ci / prisma generate / tsc) are verified locally + in CI. The
# container applies DB migrations on startup (prisma migrate deploy).

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates git && rm -rf /var/lib/apt/lists/*
# Claude Code CLI — drives Claude on a Max subscription (CLAUDE_CODE_OAUTH_TOKEN).
# Inert unless the token is provided at runtime; the offline brain is used otherwise.
RUN npm install -g @anthropic-ai/claude-code && npm cache clean --force
# Anthropic Agent Skills library: clone and expose each skill (a dir with SKILL.md)
# under ~/.claude/skills so the Claude CLI can auto-discover/use them. Fail-safe:
# if the repo is unavailable the image still builds.
RUN set -e; mkdir -p /root/.claude/skills; \
    if git clone --depth 1 https://github.com/anthropics/skills /opt/anthropic-skills 2>/dev/null; then \
      find /opt/anthropic-skills -name SKILL.md -printf '%h\n' | while read d; do \
        cp -r "$d" /root/.claude/skills/ 2>/dev/null || true; done; \
    else echo "anthropic skills repo not available at build"; fi; \
    echo "installed skills:"; ls -1 /root/.claude/skills 2>/dev/null || true
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

# Needs DATABASE_URL, REDIS_URL, and ANTHROPIC_API_KEY at runtime.
# Applies pending migrations, then starts the worker + control-plane server.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main.js"]

