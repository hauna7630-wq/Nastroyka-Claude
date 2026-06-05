# agent-os — Architecture blueprint

Diagrams render on GitHub (Mermaid). See `SPEC.md` for the prose specification.

## 1. Three planes

```mermaid
flowchart LR
  subgraph Control["Control Plane (Next.js API — Phase 4)"]
    API["HTTP API / UI"]
  end
  subgraph Execution["Execution Plane (worker)"]
    W["Worker"]
    RT["Agent runtime\n(tool-use loop)"]
    TOOLS["Tool registry\n(sandbox boundary)"]
  end
  subgraph Billing["Billing Plane"]
    LED["Ledger\n(idempotent)"]
    DB[("Postgres\nRuns/Steps/Ledger/Memory/DLQ")]
  end
  MODEL["ModelProvider\n(Claude / mock)"]
  Q[["Queue\n(BullMQ / in-memory)"]]

  API -- "enqueue RunJob" --> Q
  Q -- "deliver" --> W
  W --> RT
  RT --> TOOLS
  RT --> MODEL
  RT -- "charge per tool call" --> LED
  LED --> DB
  RT -- "Run/Step trace" --> DB
  W -- "exhausted -> DeadLetter" --> DB
```

The runtime depends only on the **ports** (`Queue`, `Repository`, `ModelProvider`); adapters are
chosen in `src/index.ts`. That boundary is what keeps the planes from drifting.

## 2. Run state machine

```mermaid
stateDiagram-v2
  [*] --> queued
  queued --> running
  queued --> canceled
  running --> paused
  running --> succeeded
  running --> failed
  running --> canceled
  paused --> running
  paused --> canceled
  succeeded --> [*]
  failed --> [*]
  canceled --> [*]
```

All status changes flow through `transition()`; illegal edges throw `IllegalTransitionError`.

## 3. Run execution sequence (happy path + billing)

```mermaid
sequenceDiagram
  participant API as Control Plane
  participant Q as Queue
  participant W as Worker (Execution)
  participant RT as Runtime
  participant M as Model
  participant T as Tool
  participant L as Ledger (Billing)

  API->>Q: enqueue(RunJob{runId})
  Q->>W: deliver(job, {attempt})
  W->>RT: executeRun(runId)
  RT->>RT: transition queued -> running
  loop tool-use loop (<= maxIterations)
    RT->>M: complete(system, messages, tools)
    M-->>RT: turn (text? + toolCalls + tokens)
    RT->>L: charge(run, stepIdx, "turn:i", tokenCredits)  %% idempotent
    alt turn has tool calls
      RT->>T: run(toolCall.input)   %% deny-by-default network
      T-->>RT: result
      RT->>L: charge(run, stepIdx, toolCallId)             %% idempotent
    else final answer
      RT->>RT: transition running -> succeeded
    end
  end
  RT-->>W: done
```

## 4. Failure / retry / DLQ

```mermaid
flowchart TD
  EXE["executeRun throws"] --> CK{"attempt < maxAttempts?"}
  CK -- yes --> RQ["audit retry_scheduled\nqueue.enqueue(job) again"]
  RQ --> EXE
  CK -- no --> FAIL["transition running -> failed"]
  FAIL --> DL["recordDeadLetter(runId, reason, attempts)"]
  DL --> AUD["audit dead_lettered"]
```

Idempotency note: because step indices and tool-call ids are deterministic, re-executing a Run on
retry re-charges the **same** `(runId, stepIndex, toolCallId)` keys, which the ledger collapses to
a single charge — so retries never double-bill.

## 5. Auto-orchestration (F6)

The worker dispatches by agent type: `orchestrator` runs go to the orchestrator, everything else
to the single-agent runtime.

```mermaid
flowchart TD
  J["dispatchRun(parent)"] --> T{"agent.type == orchestrator?"}
  T -- no --> RT["executeRun (single agent)"]
  T -- yes --> CX{"shouldOrchestrate(task)?"}
  CX -- no --> ONE["1 subtask\n(default-typed agent)"]
  CX -- yes --> PLAN["planner.plan(task)\n→ typed subtask graph"]
  ONE --> ORD["topological order"]
  PLAN --> ORD
  ORD --> LOOP["for each subtask in order"]
  LOOP --> ASSIGN["findAgentByType(orgId, subtask.type)"]
  ASSIGN --> CHILD["createRun(parentId::subtaskId)\nexecuteRun(child)  %% inline"]
  CHILD --> DEP["thread output into dependents"]
  DEP --> LOOP
  LOOP --> AGG["aggregate child outputs\nparent.creditsUsed = Σ children"]
  AGG --> OK["transition running → succeeded"]
```

Child run ids are deterministic (`parentId::subtaskId`). On an orchestration retry, completed
children are terminal and skipped (idempotent, no re-billing); only unfinished subtasks re-run.
In production (post-F4) the inline `executeRun(child)` becomes an async `queue.enqueue(child)`
coordinated by the event bus.

## 6. Control Plane + events + billing (F4)

```mermaid
flowchart LR
  client["Client / UI"]
  subgraph CP["Control Plane (src/api)"]
    API["ControlPlane\n(createRun, getRun, metrics,\nDLQ requeue, checkout/webhook)"]
    SSE["SSE /runs/:id/events"]
  end
  Q[["Queue"]]
  W["Worker + runtime/orchestrator"]
  BUS(["EventBus"])
  OBS["Observability\n(trace, token burn, cost)"]
  STRIPE["Stripe"]
  DB[("Repository\nRuns/Steps/Ledger/Grants/DLQ")]

  client -- "POST /runs" --> API
  API -- "enqueue" --> Q --> W
  W -- "publish RunEvent" --> BUS --> SSE -- "stream" --> client
  API --> OBS --> DB
  client -- "POST /billing/checkout" --> API -- "create session" --> STRIPE
  STRIPE -- "webhook (event id)" --> API -- "grant credits (idempotent)" --> DB
  client -- "POST /dlq/:id/requeue" --> API -- "reset attempts + enqueue" --> Q
```

Billing idempotency: a Stripe `checkout.session.completed` webhook is applied via a `CreditGrant`
unique on `(source, externalId)`, so a redelivered event credits the org exactly once.
