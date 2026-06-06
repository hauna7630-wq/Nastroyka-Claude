# teamly

A corporate **knowledge base + wiki** (Teamly analog), niche-agnostic. Built as a
Next.js (App Router) + Prisma/Postgres + TipTap application.

Modules: **T1 — knowledge base** (done), **T2 — AI/RAG search & assistant** (done),
**T3 — LMS** (done).

## T3: Learning (LMS)

- **Courses from the knowledge base**: `generateCourseFromSpace` builds a course with a lesson
  per KB page (each lesson linked to its page).
- **Modules, lessons, quizzes**: single/multi-correct questions with a passing score.
- **Enrollment + progress**: assign a course, mark lessons complete, take quizzes; the course
  auto-completes when every lesson is done and every quiz is passed. Grading + progress are pure
  (unit-tested); the flow is integration-tested on live Postgres.
- **UI**: `/app/courses` (list + "create from KB"), course view with progress, lesson view
  (KB material + mark complete), quiz take page with scored result.

## T2: AI search & assistant (RAG)

- **Semantic search** over page content via **pgvector** (HNSW cosine index). Pages are
  chunked, embedded, and stored on save (`PageChunk`).
- **Grounded assistant** (`/app/spaces/[id]/ask`): retrieves the top chunks, answers **only**
  from them with **source citations**, and **refuses** ("no hallucination") when nothing
  relevant is found (retrieval-threshold gate). Retrieval is **space-scoped** — no cross-tenant
  leaks.
- **Pluggable AI** behind ports (`src/lib/ai`): offline `HashEmbedder` + `ExtractiveChatModel`
  by default (deterministic, zero external calls), `OpenAIEmbedder` / `AnthropicChatModel` when
  `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are set. The pgvector column is `vector(256)` to match
  the default embedder; a real embedder requires a migration to its dimension.

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

Verified: unit 28/28, integration 12/12 (live Postgres + pgvector: KB services, RAG search +
grounded answers + refusal + space isolation, full LMS flow incl. course-from-KB generation and
progress→completion), `next build` green (11 routes).
