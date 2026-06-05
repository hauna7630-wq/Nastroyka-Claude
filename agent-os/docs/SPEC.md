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

- **Control Plane** — accepts requests, creates Runs, enqueues work, surfaces status/events.
  *(MVP: `Queue.enqueue` is the seam; a thin HTTP/API layer is Phase 4.)*
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

## 8. Agent memory **[Phase 5]**

`AgentMemory` exists in the schema with three kinds. The MVP runtime is stateless between Runs;
Phase 5 adds short-term run context injection, long-term vector recall, and episodic
summaries of prior Runs.

## 9. Orchestration **[Phase 6]**

Open design question surfaced in the review: **who controls orchestration?**

- **A — User-driven**: the user composes/sequences agents.
- **B — System-driven (target)**: an `orchestrator`-type agent decomposes a task above a
  complexity threshold into subtasks and assigns them to typed agents dynamically.

The MVP ships the `orchestrator` AgentType and the typed-agent vocabulary so the system can grow
toward (B) without a schema migration. The default today is single-agent (A).

## 10. Observability **[Phase 4]**

Primitives exist (per-Step latency + token burn, `AuditLog`). Phase 4 adds Run tracing views,
tool-latency metrics, token-burn analytics per agent, and cost-per-task dashboards.

## 11. Phase plan + dependency graph

```
F1 Core runtime + state machine + ledger + DLQ   [MVP — this repo]
F2 Persistence (Prisma/Postgres) + queue (BullMQ/Redis) + real model   depends on F1
F3 Tool sandbox isolation (code_exec)                                   depends on F1
F4 Control-plane API + events (SSE/WS) + observability + Stripe         depends on F2
F5 Agent memory (vector long-term, episodic)                           depends on F2
F6 Auto-orchestrator (system-driven multi-agent)                       depends on F4, F5
```

Rules: a phase cannot start before its dependencies are complete and tested (e.g. F4 requires a
correct ledger from F2; F6 requires the event bus from F4 and memory from F5).

## 12. Out of scope (MVP)

Finished production system, real Stripe integration, live LLM calls in tests, web UI/API routes,
deployment infrastructure, and Phases 4–6 features beyond the seams described above.
