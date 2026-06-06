# agent-os — Architecture blueprint

Diagrams render on GitHub (Mermaid). See `SPEC.md` for the prose specification.
This is an internal tool — no billing/credits; token usage is a per-step metric only.

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
  subgraph Data["Data Plane"]
    DB[("Postgres\nRuns/Steps/Memory/DLQ")]
  end
  MODEL["ModelProvider\n(Claude / mock)"]
  Q[["Queue\n(BullMQ / in-memory)"]]

  API -- "enqueue RunJob" --> Q
  Q -- "deliver" --> W
  W --> RT
  RT --> TOOLS
  RT --> MODEL
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

## 3. Run execution sequence (happy path)

```mermaid
sequenceDiagram
  participant API as Control Plane
  participant Q as Queue
  participant W as Worker (Execution)
  participant RT as Runtime
  participant M as Model
  participant T as Tool

  API->>Q: enqueue(RunJob{runId})
  Q->>W: deliver(job, {attempt})
  W->>RT: executeRun(runId)
  RT->>RT: transition queued -> running
  loop tool-use loop (<= maxIterations = 5)
    RT->>M: complete(system, messages, tools)   %% PII-masked
    M-->>RT: turn (text? + toolCalls + tokens)
    alt turn has tool calls
      RT->>T: run(toolCall.input)   %% allowlist + deny-by-default network
      T-->>RT: result
    else final answer
      RT->>RT: transition running -> succeeded
    end
  end
  RT-->>W: done (or MaxIterationsError -> needs_human)
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

Idempotency note: step ids are deterministic `(runId, index)`, so re-executing a Run on retry
upserts the same step rows (no duplicate trace).

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
  LOOP --> AGG["aggregate child outputs"]
  AGG --> OK["transition running → succeeded"]
```

Child run ids are deterministic (`parentId::subtaskId`). On an orchestration retry, completed
children are terminal and skipped (idempotent); only unfinished subtasks re-run.
In production (post-F4) the inline `executeRun(child)` becomes an async `queue.enqueue(child)`
coordinated by the event bus.

## 6. Control Plane + events (F4)

```mermaid
flowchart LR
  client["Client / UI"]
  subgraph CP["Control Plane (src/api)"]
    API["ControlPlane\n(createAgent, createRun, getRun,\nmetrics, DLQ requeue)"]
    SSE["SSE /runs/:id/events"]
  end
  Q[["Queue"]]
  W["Worker + runtime/orchestrator"]
  BUS(["EventBus"])
  OBS["Observability\n(trace, token burn)"]
  DB[("Repository\nAgents/Runs/Steps/DLQ")]

  client -- "POST /agents" --> API --> DB
  client -- "POST /runs" --> API
  API -- "enqueue" --> Q --> W
  W -- "publish RunEvent" --> BUS --> SSE -- "stream" --> client
  API --> OBS --> DB
  client -- "POST /dlq/:id/requeue" --> API -- "reset attempts + enqueue" --> Q
```
