# Nastroyka-Claude

A monorepo with two self-contained, production-grade applications plus a single-host
deploy setup.

## Projects

- **[`agent-os/`](agent-os/)** — a personal multi-agent AI orchestrator: a Run state
  machine, tool-use loop, BullMQ/Redis execution plane, sandboxed `code_exec`, vector
  long-term memory (pgvector), an SSE event bus, and a Coordinator web UI. No billing —
  it's a personal tool; token usage is kept only as a metric.
- **[`teamly/`](teamly/)** — a niche-agnostic corporate knowledge base + wiki with
  full-text search and a RAG-powered AI assistant (Next.js, Prisma/Postgres, TipTap,
  pgvector).
- **[`deploy/`](deploy/)** — Docker Compose + Caddy (auto-TLS) to run both apps on one
  VPS, driven by the GitHub Actions **Deploy** workflow. See
  [`deploy/README.md`](deploy/README.md) for the full runbook.

## CI/CD

- `.github/workflows/ci.yml` — unit + integration tests and image builds for both apps.
- `.github/workflows/deploy.yml` — builds + pushes images to GHCR, then brings the
  stack up on the host over SSH.

Each app is independent (its own `package.json`, Prisma schema, and tests); develop
inside the respective subdirectory.
