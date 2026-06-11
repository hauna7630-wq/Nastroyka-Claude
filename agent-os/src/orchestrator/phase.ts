// Task lifecycle (Doc-A stage 6): derive a human-readable phase for an
// orchestrated run from the parent status + its child runs. Pure function —
// the data is already persisted (children carry input.subtaskId; review and
// revision children use the deterministic ids ::review / ::rev1).

import { AgentType, Run, RunStatus } from '../domain/types';

export type TeamPhase =
  | 'new'        // НОВАЯ — parent queued
  | 'analyzing'  // АНАЛИЗ — parent running, no children yet (planning)
  | 'working'    // В РАБОТЕ — an ordinary subtask is active
  | 'reviewing'  // РЕВЬЮ — the ::review child is active
  | 'revising'   // ДОРАБОТКА — the ::rev1 child is active
  | 'completed'  // ГОТОВО
  | 'failed'     // ОШИБКА
  | 'needs_human'; // НУЖЕН ЧЕЛОВЕК (paused)

export const PHASE_LABEL: Record<TeamPhase, string> = {
  new: 'НОВАЯ',
  analyzing: 'АНАЛИЗ',
  working: 'В РАБОТЕ',
  reviewing: 'РЕВЬЮ',
  revising: 'ДОРАБОТКА',
  completed: 'ГОТОВО',
  failed: 'ОШИБКА',
  needs_human: 'НУЖЕН ЧЕЛОВЕК',
};

// Per-agentType activity label for the working phase ("кто что делает").
export const WORKING_LABEL: Record<AgentType, string> = {
  researcher: 'исследует',
  analyst: 'анализирует',
  writer: 'пишет текст',
  coder: 'пишет код',
  reviewer: 'проверяет',
  orchestrator: 'координирует',
};

// Debate-round id shapes: review / review2 / review3… and rev1 / rev2…
// (precise so an ordinary subtask like "revenue" isn't mistaken for a round).
export function isReviewId(sid: string): boolean {
  return /^review\d*$/.test(sid);
}
export function isRevisionId(sid: string): boolean {
  return /^rev\d+$/.test(sid);
}

export function subtaskIdOf(child: Run): string {
  const input = child.input as { subtaskId?: unknown } | null;
  if (input && typeof input === 'object' && typeof input.subtaskId === 'string') {
    return input.subtaskId;
  }
  const parts = child.id.split('::');
  return parts[parts.length - 1];
}

const ACTIVE: ReadonlySet<RunStatus> = new Set<RunStatus>(['queued', 'running']);

export function deriveTeamPhase(parent: Run, children: Run[]): TeamPhase {
  if (parent.status === 'succeeded') return 'completed';
  if (parent.status === 'failed' || parent.status === 'canceled') return 'failed';
  if (parent.status === 'paused') return 'needs_human';
  if (parent.status === 'queued') return 'new';
  // parent running:
  const active = children.filter((c) => ACTIVE.has(c.status));
  if (children.length === 0) return 'analyzing';
  for (const c of active) {
    const sid = subtaskIdOf(c);
    if (isReviewId(sid)) return 'reviewing';
    if (isRevisionId(sid)) return 'revising';
  }
  if (active.length > 0) return 'working';
  // Children exist but none active (between subtasks / aggregating).
  return 'working';
}
