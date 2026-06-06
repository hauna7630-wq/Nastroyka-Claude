# agent-os

A **runnable MVP scaffold** of a multi-tenant AI-agent runtime, structured around two
planes — **Control** and **Execution** — over a **Data** plane, with a formal Run state
machine, a tool sandbox security model, a dead-letter queue, agent memory, prompt versioning,
per-agent tool allowlists, and PII masking.

> This is an internal/personal tool: **no billing, credits, USD pricing, or payments**. Token
> usage is tracked per step as a metric only.

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
- **Security guardrails** — per-agent **tool allowlist** (enforced in the runtime) and **PII
  masking** (`src/security/pii.ts`): emails/phones/cards are masked before prompts reach the LLM
  and un-masked on the way back.
- **Tool registry + sandbox boundary** (`src/tools/*`) — deny-by-default network; the
  `http_request` tool enforces a domain allowlist; `code_exec` runs in a real isolate
  (`SubprocessSandbox`: namespaces + rlimits; or `DockerSandbox`) enforcing no-network + CPU/memory
  + wall-timeout, and refuses to run if no sandbox is configured.
- **Agent runtime** (`src/agent/runtime.ts`) — the tool-use loop: model → tools → step trace,
  driven through the state machine (token usage tracked as a metric).
- **LLM Gateway** (`src/adapters/model.gateway.ts`) — routes by rule and fails over
  primary → secondary → local.
- **Worker + DLQ** (`src/worker/worker.ts`) — retries transient failures; dead-letters on exhaustion.

## Architecture (ports & adapters)

The runtime depends only on **ports** (interfaces); adapters are swapped at the composition root
(`src/index.ts`).

| Port (`src/ports`) | Test adapter | Production adapter |
| --- | --- | --- |
| `Repository` (data) | `repo.inMemory.ts` | `repo.prisma.ts` (Postgres) |
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
trace is durably persisted in Postgres (and re-read from a fresh client). The live Anthropic smoke runs with `ANTHROPIC_API_KEY`.
Default `npm test` stays infra-free.

See [`docs/SPEC.md`](docs/SPEC.md) for the full specification and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams.

## Auto-orchestration (F6)

`orchestrator`-type runs are decomposed into typed-agent subtasks automatically: a complexity
gate decides single- vs multi-agent, a planner produces a validated subtask graph, and the
orchestrator runs the subtasks as child runs (deterministic ids → idempotent across retries).
See `src/orchestrator/*` and `docs/SPEC.md` §9.

## Control Plane (F4)

The `ControlPlane` (`src/api/controlPlane.ts`) is the API surface: create runs, read run
status + trace, observability (`runMetrics`, token burn by agent), DLQ list +
operator requeue. A zero-dependency Node
`http` + **SSE** server (`src/api/server.ts`) is the thin edge; lifecycle events flow over an
event bus (`src/events/bus.ts`). See `docs/SPEC.md` §10 and the diagram in `docs/ARCHITECTURE.md`.

## Agent memory (F5)

Agents recall relevant `long_term` + `episodic` memory into their prompt before each run and write
an `episodic` summary on success (`src/ports/memory.ts`, `src/adapters/memory.repo.ts`). Retrieval
is lexical (overlap + recency) in the MVP; production swaps embeddings + pgvector behind the same
`MemoryStore` port. Each typed agent in an orchestration recalls its own memory. See `docs/SPEC.md` §8.

## Status / roadmap

All six phases are implemented in this repo: **F1** (core runtime/state machine/DLQ),
**F2** (Prisma/Postgres + BullMQ/Redis, verified by integration tests; migrations committed),
**F3** (`code_exec` sandbox isolation — namespaces + rlimits, verified live), **F4** (control-plane API + SSE events + observability), **F5** (agent memory recall + episodic
write-back), and **F6** (auto-orchestrator). Remaining work is MVP→production hardening, not new
phases: Redis pub/sub event fan-out, vector/semantic memory, async orchestration child dispatch,
and DockerSandbox where a container runtime + images are available. See `docs/SPEC.md`.
