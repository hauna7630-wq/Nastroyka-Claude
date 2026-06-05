# agent-os

A **runnable MVP scaffold** of a multi-tenant AI-agent runtime, structured around three
planes — **Control**, **Execution**, and **Billing** — with the architectural guardrails from
the design review baked in: a formal Run state machine, idempotent credit accounting, a tool
sandbox security model, a dead-letter queue, agent memory, and prompt versioning.

It is a *scaffold*, not a finished product: the core control loop runs end-to-end with **zero
external infrastructure** (no Postgres, Redis, or API key) via in-memory adapters, while
production adapters (Prisma, BullMQ, Anthropic) are wired but not exercised by tests.

## Quick start

```bash
cd agent-os
npm install
npm test          # runs the full suite (no infra/keys required)
npm run typecheck # tsc --noEmit, incl. production adapters
```

## What actually runs (and is tested)

- **Run state machine** (`src/domain/runStateMachine.ts`) — legal transitions only; terminal
  states reject outgoing edges.
- **Idempotent ledger** (`src/billing/ledger.ts`) — a `(runId, stepIndex, toolCallId)` tuple is
  charged exactly once, even across retries.
- **Tool registry + sandbox boundary** (`src/tools/*`) — deny-by-default network; the
  `http_request` tool enforces a domain allowlist; `code_exec` is disabled pending a real sandbox.
- **Agent runtime** (`src/agent/runtime.ts`) — the tool-use loop: model → tools → step trace →
  billing, driven through the state machine.
- **Worker + DLQ** (`src/worker/worker.ts`) — retries transient failures; dead-letters on exhaustion.

## Architecture (ports & adapters)

The runtime depends only on **ports** (interfaces); adapters are swapped at the composition root
(`src/index.ts`).

| Port (`src/ports`) | Test adapter | Production adapter |
| --- | --- | --- |
| `Repository` (data/billing) | `repo.inMemory.ts` | `repo.prisma.ts` (Postgres) |
| `Queue` (control↔execution) | `queue.inMemory.ts` | `queue.bullmq.ts` (Redis) |
| `ModelProvider` (LLM) | `model.mock.ts` | `model.anthropic.ts` (Claude) |

## Running with real infrastructure (F2)

The production adapters are verified against **live Postgres + Redis**:

```bash
docker compose up -d                 # Postgres + Redis (docker-compose.yml)
export DATABASE_URL="postgresql://agentos:agentos@localhost:5432/agent_os"
export REDIS_URL="redis://localhost:6379"
npm run db:migrate                   # apply prisma/migrations/
npm run test:integration             # real Prisma + BullMQ end-to-end
npm start                            # worker + control-plane HTTP/SSE server
```

`npm run test:integration` runs a full run lifecycle through the real BullMQ worker and asserts the
trace + ledger are durably persisted in Postgres (and re-read from a fresh client), plus DB-level
ledger idempotency via the unique constraint. The live Anthropic smoke runs with `ANTHROPIC_API_KEY`.
Default `npm test` stays infra-free.

See [`docs/SPEC.md`](docs/SPEC.md) for the full specification and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams.

## Auto-orchestration (F6)

`orchestrator`-type runs are decomposed into typed-agent subtasks automatically: a complexity
gate decides single- vs multi-agent, a planner produces a validated subtask graph, and the
orchestrator runs the subtasks as child runs (deterministic ids → idempotent across retries).
See `src/orchestrator/*` and `docs/SPEC.md` §9.

## Control Plane (F4)

The `ControlPlane` (`src/api/controlPlane.ts`) is the API surface: create runs (with cost
preview), read run status + trace, observability (`runMetrics`, token burn by agent), DLQ list +
operator requeue, and Stripe checkout + webhook (idempotent credit grants). A zero-dependency Node
`http` + **SSE** server (`src/api/server.ts`) is the thin edge; lifecycle events flow over an
event bus (`src/events/bus.ts`). See `docs/SPEC.md` §10 and the diagram in `docs/ARCHITECTURE.md`.

## Agent memory (F5)

Agents recall relevant `long_term` + `episodic` memory into their prompt before each run and write
an `episodic` summary on success (`src/ports/memory.ts`, `src/adapters/memory.repo.ts`). Retrieval
is lexical (overlap + recency) in the MVP; production swaps embeddings + pgvector behind the same
`MemoryStore` port. Each typed agent in an orchestration recalls its own memory. See `docs/SPEC.md` §8.

## Status / roadmap

Done in this repo: **F1** (core runtime/state machine/ledger/DLQ), **F2** (Prisma/Postgres +
BullMQ/Redis, verified by integration tests; migrations committed), **F4** (control-plane API +
SSE events + observability + Stripe top-ups), **F5** (agent memory recall + episodic write-back),
and **F6** (auto-orchestrator). Remaining: **F3** (`code_exec` sandbox isolation), plus the
documented MVP→production swaps (Redis pub/sub event fan-out, vector/semantic memory). See the
phased plan in `docs/SPEC.md`.
