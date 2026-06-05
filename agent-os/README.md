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

## Production wiring (not required for tests)

```bash
cp .env.example .env      # set DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, ALLOWLIST_DOMAINS
npm run db:generate       # prisma generate
npm run db:migrate        # prisma migrate dev
npm run worker            # start the execution-plane worker with real adapters
```

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

## Status / roadmap

Implemented at MVP altitude: **F1** (core runtime/state machine/ledger/DLQ), **F4** (control-plane
API + SSE events + observability + Stripe top-ups), and **F6** (auto-orchestrator, inline).
Deferred (seams left in the schema/ports): production adapters wiring (F2 — Postgres/Redis/Anthropic
live), vector long-term + episodic memory (F5), and `code_exec` sandbox isolation (F3). See the
phased plan in `docs/SPEC.md`.
