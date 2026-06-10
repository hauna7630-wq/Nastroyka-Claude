# Office Visual System — Audit & Backlog (toward reference parity)

Reference targets: Project Highrise, Software Inc, Two Point Campus, Startup Company.
Goal: a living digital office, not a tech demo. This file is the required
audit → gap list → prioritized backlog that precedes visual changes.

> Constraint: rendering is hand-coded `<canvas>` (no art assets / sprite atlases yet),
> served inline by agent-os. The dev sandbox cannot see the rendered pixels, so visual
> acceptance is done by the user / the on-box Claude. AAA-художник-parity is a
> direction, not a one-shot deliverable.

## Current state (v11)

- True 2:1 isometric floor (diamond tiles), two back walls with skewed windows.
- Per-department cubicle partitions + department name plates + soft zone tint.
- Detailed characters on the iso grid (body/hair-styles/face/glasses/shadow,
  per-agent look), depth-sorted; walk with stride/arm-swing; meetings at an iso table.
- Iso desks (cuboids) + billboard monitors (screen content), mug/papers, status dot.
- Decor: iso plants, water cooler, printer, coffee machine, meeting rug.
- Activity feed (text), live status from real run/SSE events.

## Gap vs references

| Area | Gap |
| --- | --- |
| Role identity | Workstations look the same per role — no role-specific props (analyst charts, dev multi-monitor, researcher books, reviewer checklist, architect diagram board). |
| Agent interaction | Task hand-offs/reviews/research are not *shown* — no connection lines / data packets between agents. **Biggest "not alive" complaint.** |
| Density | Floor still reads sparse; needs more furniture, rooms (meeting room, server zone, lounge), glass partitions, corridors. |
| Animations | Mostly idle; need typing, screen flicker/scene-change, progress bars, server blinkenlights, light sweeps. |
| Camera | No zoom/pan/focus; no follow-active-agent / cinematic. |
| Event system | Events are text-only; need floating cards/markers (research found, task done, issue raised, design created). |
| UI overlays | No project panel (status/progress/blockers) or agent panel (role/current task/history/KPIs). |
| LOD / perf | No LOD tiers, sprite atlases, batching; fine at 7 agents, needs structure to scale. |

## Prioritized backlog

**P0 — make it feel alive (highest impact, this iteration)** — ✅ SHIPPED (v12)
1. ✅ **Agent interaction visualization** — `drawAgentLinks`: animated dashed link +
   moving glowing data-packet from the orchestrator (Arkesha) to each working agent;
   settles to a green link when the agent's subtask is done. (Verified served: `drawAgentLinks=2`.)
2. ✅ **Role-specific workstations** — `drawRoleProps`: distinct desk props per role
   (analyst bar-chart, researcher books+magnifier, coder 2nd monitor, reviewer checklist,
   writer doc+pen, orchestrator diagram board). Hand-off/review pulses → still P1.

**P1 — depth & readability**
3. Camera: smooth zoom (wheel/buttons) + pan; focus/follow active agent.
4. Richer activity feed: icons + categories + agent links + grouping.
5. More office: dedicated meeting room, server zone, lounge, glass partitions, corridors.

**P2 — animation & events**
6. Per-workstation animation (typing, screen scene-change, progress bars, server blink).
7. Floating event cards/markers tied to run events (found / done / issue / design).
8. Ambient light sweep + screen glow; day cycle (optional).

**P3 — overlays & scale**
9. Project panel (status/progress/active agents/blockers) + agent inspector panel.
10. LOD tiers + offscreen culling + (eventually) sprite atlases for many agents.

## Acceptance

Each item ships, then is visually accepted by the user / on-box Claude against the
reference screenshots; iterate until the scene reads as a living office, not a demo.
