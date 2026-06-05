# agent-os — Specification (v2)

> Status: MVP scaffold. This document is the hardened spec produced from the architecture
> review. Sections marked **[MVP]** are implemented and tested in this repo; **[Phase N]**
> sections are designed-for but deferred, with seams left in the schema and ports.

## 1. Product

A multi-tenant SaaS where organizations run **AI agents** that execute **Runs** (tasks). Each
Run is a model-driven **tool-use loop** that produces an auditable **Step** trace and consumes
**credits**. It is, in effect, a simplified agent control plane.

## 2. Planes (separation of concerns)

The system is split into three planes so that Run lifecycle and billing logic cannot drift:

- **Control Plane** — accepts requests, creates Runs, enqueues work, surfaces status/events,
  manages the DLQ, and handles billing top-ups. **[F4]** — `ControlPlane` (`src/api/controlPlane.ts`)
  with a Node HTTP + SSE adapter (`src/api/server.ts`).
- **Execution Plane** — the worker that drains the queue and executes the agent runtime. **[MVP]**
- **Billing Plane** — the credit ledger and balances; the financial source of truth. **[MVP]**

Planes communicate only through **ports** (`src/ports/*`): `Queue`, `Repository`, `ModelProvider`.

## 3. Run state machine **[MVP]**

A Run's status changes only through `transition()` (`src/domain/runStateMachine.ts`); arbitrary
"jumps" are illegal.

```
queued  → running, canceled
running → paused, succeeded, failed, canceled
paused  → running, canceled
succeeded | failed | canceled  → (terminal)
```

- Duplicate delivery of a terminal Run is an idempotent no-op (not an illegal transition).
- The Execution Plane owns the terminal `running → failed` transition and DLQ routing.

## 4. Tool execution + sandbox security model **[MVP for policy; Phase 3 for isolation]**

Every tool declares a security profile (`src/tools/registry.ts`):

```
- network: deny-by-default; opt-in via explicit allowlist
- cpuMs:   max CPU time per tool call
- memMb:   max memory per run/tool call
- persistFs: no filesystem persistence except declared artifacts
```

- `http_request` **[MVP]**: enforces the domain allowlist (`ALLOWLIST_DOMAINS`); denies all else.
- `code_exec` **[Phase 3]**: disabled until a real isolate (separate process / gVisor /
  Firecracker microVM) enforces the limits above. It refuses to run in the MVP.

## 5. Billing — idempotent credits **[MVP]**

A Run can fail mid-step and be retried; retries must never double-charge. Idempotency is keyed on
`(runId, stepIndex, toolCallId)`:

- Enforced at the DB level by `@@unique([runId, stepIndex, toolCallId])` on `CreditLedger`.
- The `Ledger` (`src/billing/ledger.ts`) treats a duplicate insert as a no-op.
- `cost.ts` provides a **cost-prediction** primitive (`estimateRunCost`) the Control Plane can
  surface to the user before a Run starts (Phase 4 UI).

## 6. Data model (Prisma v2, Postgres) **[MVP schema]**

See `prisma/schema.prisma`. Highlights:

- `Org` — tenant root; `creditBalance` denormalised, `CreditLedger` is the source of truth.
- `Agent` — typed by `AgentType` (researcher | writer | analyst | coder | orchestrator |
  reviewer); points at an active `PromptVersion`.
- `PromptVersion` — **prompt registry / versioning** with `changelog`; rollback = activate an
  older row.
- `Run` / `Step` — lifecycle + execution trace; `Step` carries `latencyMs`, `tokensIn`,
  `tokensOut` as **observability** primitives.
- `AgentMemory` — `short_term | long_term | episodic` (vector backing is Phase 5).
- `CreditLedger` — idempotent billing (see §5).
- `DeadLetter` — failed Runs for inspection/requeue.
- `AuditLog` — who/what/when for every significant action.

## 7. Reliability — DLQ **[MVP]**

The worker retries transient failures up to `maxAttempts`; on exhaustion it performs
`running → failed` and writes a `DeadLetter` record. Manual requeue UI is Phase 4.

## 8. Agent memory **[F5 — implemented at MVP altitude]**

`AgentMemory` (three kinds: `short_term`, `long_term`, `episodic`) is wired into the runtime via
the `MemoryStore` port (`src/ports/memory.ts`):

- **Recall**: before each run the runtime recalls relevant `long_term` + `episodic` memory for the
  agent and injects it into the system prompt under a `# Relevant memory` heading. Because every
  child run in an orchestration (F6) goes through the runtime, each typed agent recalls **its own**
  memory.
- **Write-back**: on success the runtime stores an `episodic` record (`{ task, summary }`) scoped to
  the run, so future related runs can recall it.
- **Retrieval**: the MVP adapter (`src/adapters/memory.repo.ts`) ranks by **lexical overlap +
  recency** (stopword-filtered); `short_term` is hidden unless scoped to its run.

MVP boundary: retrieval is lexical, not semantic. Production swaps in embeddings + pgvector behind
the same `MemoryStore` port (the seam is already in place) — no runtime change required.

## 9. Orchestration **[F6 — implemented at MVP altitude]**

Open design question surfaced in the review: **who controls orchestration?**

- **A — User-driven**: the user composes/sequences agents.
- **B — System-driven (implemented)**: an `orchestrator`-type run is gated on a **complexity
  estimate**; above the threshold the system asks a **planner** for a typed-agent subtask graph,
  then executes the subtasks as **child runs** assigned to agents by `AgentType`.

How it works (`src/orchestrator/*`, dispatched from the worker via `src/agent/dispatch.ts`):

1. **Complexity gate** (`complexity.ts`): `shouldOrchestrate(task)` — below threshold, a single
   default-typed agent handles the task (fast path).
2. **Planner** (`planner.ts`): `StaticPlanner` (deterministic) or `ModelPlanner` (asks the model
   for a validated JSON plan). Plans are normalized and topologically sorted; cycles/invalid
   agent types are rejected.
3. **Execution** (`orchestrator.ts`): subtasks run in dependency order; each upstream output is
   threaded into its dependents. Child run ids are deterministic
   (`<parentRunId>::<subtaskId>`), so an **orchestration retry reuses completed children** —
   idempotent, no double-billing — and re-runs only what hadn't succeeded.
4. **Aggregation**: child outputs are collected into the parent run's output; the parent's
   `creditsUsed` is the roll-up of child run credits.

MVP boundary: children execute **inline**. Production (after F4) would enqueue each child onto
the Queue and coordinate completion via the event bus; the inline form keeps F6 testable today.
Nested orchestration (an orchestrator subtask) is intentionally not spawned.

## 10. Observability + Control-Plane API + billing **[F4 — implemented at MVP altitude]**

- **Event bus** (`src/events/bus.ts`): runtime/orchestrator/worker publish `RunEvent`s
  (`run.started`, `step.appended`, `run.succeeded`, `run.failed`, `run.dead_lettered`,
  `orchestration.planned`). The API streams them per-run over **SSE**. Production backs the bus
  with Redis pub/sub; the in-memory bus is the reference adapter.
- **Control-plane API** (`src/api/controlPlane.ts`): create runs (+ cost preview), read run
  status/trace, observability (`runMetrics`, `tokenBurnByAgent`), DLQ list + **operator requeue**
  (resets the attempt budget and re-opens the run), and billing checkout + webhook. Framework-
  agnostic; the HTTP/SSE server (`src/api/server.ts`) is a thin Node-`http` adapter.
- **Observability** (`src/observability/metrics.ts`): run tracing (per-step latency + token burn),
  per-run aggregate metrics, and token-burn-by-agent. Dashboards/materialisation are future work.
- **Billing top-up (Stripe)** (`src/billing/payments.ts`, `src/adapters/payments.stripe.ts`):
  checkout creation + webhook → **idempotent** credit grant keyed on the Stripe event id
  (`CreditGrant` `@@unique([source, externalId])`), so a redelivered webhook never double-credits.

## 11. Phase plan + dependency graph

```
F1 Core runtime + state machine + ledger + DLQ   [MVP — this repo]
F2 Persistence (Prisma/Postgres) + queue (BullMQ/Redis) + real model   depends on F1
F3 Tool sandbox isolation (code_exec)                                   depends on F1
F4 Control-plane API + events (SSE/WS) + observability + Stripe  [MVP — this repo]  depends on F2
F5 Agent memory (long-term + episodic recall)     [MVP — this repo]     depends on F2 for vector store
F6 Auto-orchestrator (system-driven multi-agent)  [MVP — this repo]     full form depends on F4, F5
```

Rules: a phase cannot start before its dependencies are complete and tested (e.g. F4 requires a
correct ledger from F2). **F4, F5 and F6 are implemented ahead of F2 at MVP altitude** against the
in-memory adapters: the event bus is in-process (not Redis pub/sub), F6 subtasks run inline (not
via the queue + events), and memory recall is lexical (not vector/semantic). The full forms land
once the production adapters (F2 — Postgres/Redis/embeddings) are wired.

## 12. Out of scope (MVP)

Finished production system, real Stripe integration, live LLM calls in tests, web UI/API routes,
deployment infrastructure, and Phases 4–6 features beyond the seams described above.
