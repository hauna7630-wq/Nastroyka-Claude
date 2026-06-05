# teamly

A corporate **knowledge base + wiki** (Teamly analog), niche-agnostic. Built as a
Next.js (App Router) + Prisma/Postgres + TipTap application.

This is **T1 — the knowledge base module**. Roadmap: T2 — AI/RAG search & assistant,
T3 — LMS (courses, tests, assignments).

## What T1 delivers

- **Multi-tenant**: Org → Workspace → Space → Page tree → PageVersion, with workspace
  roles (owner/admin/editor/viewer) and an RBAC matrix.
- **Wiki pages**: nested page tree, TipTap rich-text editor with **debounced autosave**
  and full **version history**.
- **Comments** on pages.
- **Full-text search** over page content (Postgres `tsvector`, highlighted snippets) —
  the precursor to T2's vector/RAG search.
- **Auth**: bcrypt passwords + HMAC-signed stateless session cookie.

## Architecture

```
src/lib/          pure logic (tiptap text extract, page tree, rbac, slug, auth) — unit-tested
src/lib/services/ DB services (pages, spaces, comments, search, org) — integration-tested
src/lib/db.ts     Prisma client
src/app/          Next.js App Router: login, space view, page editor, search
prisma/schema.prisma  Org/User/Membership/Workspace/Space/Page/PageVersion/Comment/AuditLog
```

The runtime separates **pure logic** (no I/O, unit-tested) from **DB services** (Prisma,
integration-tested against live Postgres), so the default test run needs no infra.

## Quick start

```bash
docker compose up -d                 # Postgres (docker-compose.yml)
cp .env.example .env                 # set DATABASE_URL + AUTH_SECRET
npm install
npm run db:migrate                   # apply prisma/migrations/
npm run db:seed                      # demo org + pages (owner@acme.test / secret123)
npm run dev                          # http://localhost:3000
```

## Tests

```bash
npm test                 # pure-logic + auth unit tests (no infra)
npm run test:integration # DB services on live Postgres (needs DATABASE_URL)
npm run build            # Next.js production build (typechecks all routes)
```

Verified: unit 13/13, integration 5/5 (live Postgres), `next build` green, runtime smoke
(login → space → editor → search) passing.
