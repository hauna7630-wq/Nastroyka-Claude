# Living Autonomous AI Organization — Product Vision & Architecture

> Transformation of `agent-os` from a multi-agent **platform** into a **living digital
> company**: departments, teams, projects, autonomous hiring, internal communication,
> a hierarchy, and a continuous simulation that the user *observes and manages* rather
> than operates.

This document is the design answer to the "Living Autonomous AI Organization" brief. It
is intentionally implementation-oriented: every concept maps to a concrete service, data
model, or UI screen, and ends with a **phased delivery roadmap** so it ships incrementally
on top of the current system instead of as a big-bang rewrite.

---

## 0. Honest constraints (read first)

Two realities shape every design decision below:

1. **Intelligence needs an LLM.** Genuine professional reasoning, natural agent-to-agent
   discussion, and autonomous hiring decisions require a capable model. The current prod
   runs on **offline deterministic adapters** because `api.anthropic.com` is geo-blocked
   from the Russian VPS. Everything here is designed against an **`LLMGateway` port** so we
   can plug in a real model. Until one is wired, agents *simulate* activity convincingly
   (scripted/heuristic), but they do not *think*. See §11.
2. **Cost & runaway risk scale super-linearly.** A "living" org generates messages,
   meetings, and initiatives continuously. Naively, that is an unbounded LLM bill and an
   infinite-loop risk. The **Simulation Engine** (§4) is therefore built around budgets,
   tick-rate limits, and an activity scheduler — not free-running agents.

---

## 1. New Product Vision

**From:** a tool that runs agent tasks.
**To:** a digital company you watch work.

The user opens a **Company HQ** and sees an organization that is already busy: projects in
flight, employees at desks, a live activity feed, chatter in department channels. They set
**business objectives** ("Launch a marketplace-analytics product"), and the organization
**self-organizes** — forms departments and teams, hires missing specialists, plans,
executes, reviews, and reports. The user's role shifts from *operator* (issuing commands)
to *executive* (setting goals, approving, observing).

Three pillars:

- **Operational reality** — the same objects a real company has (org chart, projects,
  tasks, approvals, KPIs) actually drive behavior, not just decorate the UI.
- **Continuous life** — there is always visible activity (the Simulation Engine), so the
  company never feels static.
- **Observability of mind** — you can open any employee and see their current reasoning,
  tasks, messages, outputs, and KPI history.

---

## 2. Revised Domain Model

New first-class entities (additive to the existing `Org`/`Agent`/`Run`/`Step`):

| Entity | Purpose |
| --- | --- |
| `Company` | Tenant root (rename/extends `Org`). Holds objectives, budget, health score. |
| `Department` | Marketing, Product, Engineering, Ops, Finance, Legal, Executive. |
| `Team` | A staffed group, usually project-scoped, with a lead. |
| `Employee` | Extends `Agent`: position, department, seniority, expertise, status, KPIs, manager. |
| `RoleArchetype` | The professional template an Employee instantiates (see §7). |
| `Project` | Objective container: goals, milestones, tasks, war-room channel, deliverables. |
| `Objective` / `Milestone` / `Task` | Work breakdown; tasks carry status, assignee, deps, blockers. |
| `Channel` | Communication space: company / department / project / DM (see §5). |
| `Message` | A post in a channel, authored by an Employee or the user. |
| `Decision` / `Approval` / `Escalation` | Governance objects with an authority chain. |
| `ActivityEvent` | Append-only feed item (the "Live Activity Feed"). |
| `KPI` / `PerformanceRecord` | Per-employee + per-team metrics over time. |

Everything hangs off `Company` for multi-tenant isolation (it stays a personal tool today,
but the model is tenant-clean).

### Prisma additions (sketch)

```prisma
model Department { id String @id @default(cuid()) companyId String name String headId String? }
model Employee {
  id String @id @default(cuid())
  companyId String departmentId String?
  agentId String @unique            // reuses the existing Agent runtime
  position String  seniority String // junior|mid|senior|lead|head|c_level
  archetype String                  // RoleArchetype key
  managerId String?                 // reporting chain
  status EmployeeStatus @default(idle)
  // KPIs, expertise tags, hiredAt, contractType (permanent|contractor|consultant)
}
model Project { id String @id @default(cuid()) companyId String name String objective String stage ProjectStage }
model Channel { id String @id @default(cuid()) companyId String kind ChannelKind scopeId String? } // dept/project/dm
model Message { id String @id @default(cuid()) channelId String authorEmployeeId String? body String createdAt DateTime @default(now()) }
model ActivityEvent { id String @id @default(cuid()) companyId String kind String actorId String? payload Json createdAt DateTime @default(now()) }
enum EmployeeStatus { idle working reviewing waiting researching in_meeting escalated blocked }
```

---

## 3. Organization Hierarchy & Governance

A real reporting/authority tree:

```
CEO
├── COO ── Ops, People/HR
├── CTO ── Engineering, QA, Data
├── CMO ── Marketing, Content, SEO
├── CFO ── Finance, Budget
└── CLO ── Legal/Compliance
        └── Department Heads → Team Leads → Employees
```

Governance rules encoded as data, not prose:

- **Approvals**: spend over a threshold, external publishing, hiring → require the manager
  (or C-level) in the chain to approve. Modeled as `Approval` objects routed up the tree.
- **Escalations**: a blocked task auto-escalates to the team lead after N ticks, then to the
  department head. Escalation is an `ActivityEvent` + a DM.
- **Reporting**: each tick, leads roll up team status to heads; heads to C-suite; the user
  sees a digest on the HQ dashboard.

---

## 4. Organization Simulation Engine

The heart of "living." A **tick-based scheduler** (not free-running agents) that, each tick:

1. **Advances work** — pushes ready tasks to assignees (reusing the existing Run/worker).
2. **Generates social activity** — meetings, reviews, knowledge-sharing, status chatter,
   selected by weighted policies, each emitting `ActivityEvent`s + `Message`s.
3. **Detects & acts on gaps** — capability gaps → hiring (§6); idle employees → reassignment;
   blocked tasks → escalation.
4. **Updates KPIs & health** — throughput, cycle time, rework rate → org health score.

Controls that keep it safe and affordable:

- **Tick budget**: max LLM calls + max new messages per tick (hard caps).
- **Activity scheduler**: probabilistic but rate-limited; "always something happening" without
  flooding.
- **Two clocks**: a fast UI clock (animations, movement) is pure frontend; the backend
  simulation clock is slow (seconds–minutes) and bounded. This decouples *looking* alive
  from *spending* to be alive.
- **Pause/step/speed** controls for the user (like a city-builder).

Implementation: a dedicated `simulation-worker` (BullMQ repeatable job) + Redis pub/sub for
real-time fan-out to the UI (SSE/WS). State in Postgres; ephemeral presence in Redis.

---

## 5. Internal Communication Architecture

A Slack-like substrate agents actually use to coordinate.

- **Channels**: `company`, one per `department`, one per `project` (war room), and `DM`
  pairs. Backed by `Channel` + `Message`.
- **Addressing & turn-taking**: messages can @mention an employee or a role; a lightweight
  **conversation manager** decides who responds (avoids everyone-replies-to-everyone storms)
  using turn budgets per thread.
- **Agent-to-agent protocol**: structured intents under the prose — `REQUEST`, `CLARIFY`,
  `HANDOFF`, `REVIEW`, `APPROVE`, `BLOCKER`. The UI renders prose; the engine routes on the
  intent.
- **Observation**: the user reads every channel in real time and can post (as CEO) into any
  channel; an employee will respond.
- **Transport**: Redis pub/sub → server → SSE/WS → UI. Persistence in Postgres for history.

---

## 6. Autonomous Hiring Framework

When the org detects it lacks a capability (e.g. a project needs an "SEO Specialist"):

1. **Gap detection** — Team Formation (§7) compares required vs available archetypes.
2. **Job spec** — generate a JD (responsibilities, required skills, seniority) from the gap.
3. **Candidate synthesis** — generate 2–4 candidate `Employee` profiles by composing
   `RoleArchetype` traits (skills, seniority, comms style) with variation.
4. **Evaluation** — score candidates against the JD (HR archetype = the existing *Kadrina*),
   structured rubric; pick the best.
5. **Hire & onboard** — instantiate the Employee (creates the backing `Agent` + system
   prompt from the archetype), attach to department/team, emit an onboarding plan + an
   `employee.hired` activity event.

Contract types: `permanent`, `contractor` (auto-offboarded at project end), `consultant`
(advisory, no task ownership). All hiring is an **`Approval`** routed to the relevant
manager/C-level, so it stays governable.

---

## 7. Team Formation Engine

On a new `Project`:

1. **Requirement analysis** — decompose the objective into capability needs (which archetypes,
   how many, what seniority).
2. **Staffing** — match needs to available employees; flag gaps → trigger hiring (§6).
3. **Structure** — assemble a `Team`, assign a **lead** (senior of the dominant discipline),
   define responsibilities (RACI-style).
4. **Plan** — produce milestones + an initial task graph with dependencies.
5. **Kickoff** — open the project war-room channel, post the plan, set everyone's status.

The user *watches the team assemble* — each step is an animated activity event in the office
and feed.

---

## 8. Professional Role Framework

To support **thousands of professional archetypes** without thousands of bespoke prompts,
an archetype is **composable**:

```
RoleArchetype = {
  key, title, department, seniorityBand,
  knowledge:   [domains, frameworks, standards],
  behavior:    [decision-framework, risk-posture, initiative-level],
  comms:       [tone, verbosity, formality],
  kpis:        [metric definitions],
  tools:       [allowed tool ids],
  promptTemplate: composed from the above
}
```

A **prompt compiler** renders the system prompt from these traits, so new professions are a
data row, not code. Ships with a seed library (Backend Engineer, PM, CMO, Legal Counsel,
Data Analyst, SEO, Copywriter, QA, …) and a trait taxonomy to extend. Seniority modifies
behavior (a Senior does architecture/mentoring/review; a Junior executes and asks).

This generalizes the team we already seed (*Arkesha/Kadrina/Iskara/…*) into a catalog.

---

## 9. Autonomous Project Execution

Objective in → deliverables out, no manual orchestration:

```
Objective
 → Project created (+ war room)
 → Departments engaged
 → Team formed (§7)  ── hires if needed (§6)
 → Research → Strategy → Roadmap
 → Tasks executed (existing Run/worker), discussed in channels (§5)
 → Reviews & approvals (governance §3)
 → Deliverables produced
 → Progress reported to HQ
```

This reuses the **existing orchestrator** (planner → DAG → child runs) as the *task-execution*
layer, and wraps it with the *organizational* layer (projects, channels, governance, KPIs).

---

## 10. UI/UX Redesign (screen by screen)

Replaces the 3-tab admin with a modern app shell (sidebar + workspace), inspired by
Linear/Notion/Slack/ClickUp.

1. **Company HQ (Dashboard)** — objectives, active projects, employee count, department
   workload, budget/utilization, **org health score**, and the **Live Activity Feed**.
2. **Virtual Office** — the pixel canvas, upgraded: employees **walk** between desks, gather
   for **meetings**, show status; rooms per department; decor (walls, rugs, water cooler,
   role icons over desks). Clicking an employee opens their profile.
3. **Employee Profile** — position, department, seniority, expertise, **current reasoning**,
   assigned tasks, messages, outputs, KPI history.
4. **Org Chart** — interactive hierarchy graph (CEO→…→employees), reporting & approval lines.
5. **Projects / War Room** — per-project board: milestones, task dependency graph, timeline,
   deliverables, and the project channel.
6. **Communications** — Slack-style channel list (company/department/project/DM) with live
   messages; the user can post as CEO.
7. **People / Hiring** — the org chart's HR view: open roles, candidates, hiring approvals.
8. **Department Dashboards** — workload, KPIs, members per department.

Real-time everywhere via SSE/WS.

---

## 11. Technical Challenges & Risks

- **LLM access (RU)** — `api.anthropic.com` is geo-blocked. Options: (a) an egress **proxy**
  outside RU; (b) a **Russian/OpenAI-compatible** provider (YandexGPT, GigaChat) behind the
  `LLMGateway`; (c) a **self-hosted** open model (e.g. on a GPU host). The gateway already
  supports failover, so multiple can coexist. **This is the gating decision for real autonomy.**
- **Cost** — continuous activity × LLM calls can explode. Mitigation: tick budgets, cheap
  models for chatter / strong models for decisions (tiered routing), caching, and "simulate
  cheaply, think rarely."
- **Runaway / loops** — agents talking forever. Mitigation: per-thread turn budgets, the
  conversation manager, max-iterations (already in the runtime), and the tick scheduler.
- **Scalability** — N employees × messages × ticks. Mitigation: Redis presence, batched
  fan-out, pagination, and capping concurrent "thinking" employees.
- **Determinism & testing** — a living system is hard to test. Mitigation: the offline
  adapters stay as a deterministic mode for CI; simulation seeded with a fixed RNG.
- **Observability** — every activity event, message, decision, and run is persisted and
  traceable (extends the current Run/Step trace).

---

## 12. Phased Delivery Roadmap

Ships value continuously; each phase is independently deployable.

- **P0 — Living office (visual), now.** Frontend simulation on the existing canvas: employees
  **walk/idle/work**, a **Live Activity Feed**, and an in-office **chat panel** where agents
  post messages tied to real run events. Pure frontend + small read APIs. *No LLM needed.*
- **P1 — Org model & HQ shell.** Add `Department/Employee/Project/Channel/Message/ActivityEvent`
  to Prisma; new app-shell UI (sidebar), Company HQ dashboard, Communications channels (read +
  CEO post). Activity feed becomes real (DB-backed).
- **P2 — Team Formation + Project execution.** Objective → project → team assembly →
  task graph, wrapping the existing orchestrator. War-room channel with scripted coordination.
- **P3 — Professional Role Framework.** Archetype catalog + prompt compiler; seniority behavior.
- **P4 — Autonomous Hiring + Governance.** Gap detection, candidate synthesis, HR evaluation,
  approvals/escalations up the hierarchy.
- **P5 — Simulation Engine (backend, continuous).** The tick scheduler, budgets, meetings,
  KPIs, org health — the always-on life. **Real autonomy here depends on the LLM decision (§11).**

> Recommendation: build **P0 immediately** (visible, no blockers), stand up **P1** next, and in
> parallel resolve the **LLM access** decision so P2–P5 deliver real intelligence rather than
> simulation.
