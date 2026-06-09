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
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./

# Needs DATABASE_URL, REDIS_URL, and ANTHROPIC_API_KEY at runtime.
# Applies pending migrations, then starts the worker + control-plane server.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main.js"]

