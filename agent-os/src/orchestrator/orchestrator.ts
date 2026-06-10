// Auto-orchestrator (F6): system-driven multi-agent execution.
//
// Flow for an `orchestrator`-type run:
//   1. Gate on complexity — below threshold, run a single agent (fast path).
//   2. Otherwise ask the planner for a typed-agent subtask graph.
//   3. Execute subtasks in topological order as CHILD runs, each assigned to an
//      agent of the requested type, feeding upstream outputs into dependents.
//   4. Aggregate child outputs into the parent run's output.
//
// Child run ids are deterministic (`<parentRunId>::<subtaskId>`), so an
// orchestration retry reuses completed children (idempotent re-execution)
// and only re-executes the ones that had not yet succeeded.
//
// MVP note: children run inline here. Production would enqueue each child onto
// the Queue and coordinate completion via the event bus (F4); the inline form
// keeps F6 testable before F4/F5 exist.

import { isTerminal, transition } from '../domain/runStateMachine';
import { executeRun, RunNotFoundError, RuntimeDeps, toPrompt } from '../agent/runtime';
import { AgentType } from '../domain/types';
import { emit } from '../events/bus';
import { Queue } from '../ports/queue';
import {
  DEFAULT_COMPLEXITY_THRESHOLD,
  shouldOrchestrate,
} from './complexity';
import {
  OrchestrationPlan,
  OrchestrationSubtask,
  Planner,
  topoSort,
} from './planner';

export interface OrchestratorDeps extends RuntimeDeps {
  planner: Planner;
  complexityThreshold?: number;
  // Agent type used for the single-agent fast path when a task is simple.
  defaultAgentType?: AgentType;
  // Production: dispatch each child onto the queue and await its completion via
  // the event bus, instead of running it inline. Requires `queue` + `events`.
  asyncChildren?: boolean;
  queue?: Queue;
}

export async function executeOrchestration(
  parentRunId: string,
  deps: OrchestratorDeps,
): Promise<void> {
  const { repo, planner } = deps;
  const threshold = deps.complexityThreshold ?? DEFAULT_COMPLEXITY_THRESHOLD;
  const defaultAgentType = deps.defaultAgentType ?? 'researcher';

  const parent = await repo.getRun(parentRunId);
  if (!parent) throw new RunNotFoundError(parentRunId);

  if (isTerminal(parent.status)) {
    await repo.audit({
      orgId: parent.orgId,
      runId: parentRunId,
      actor: 'orchestrator',
      action: 'run.skipped_terminal',
      meta: { status: parent.status },
    });
    return;
  }

  if (parent.status !== 'running') {
    await repo.updateRunStatus(parentRunId, transition(parent.status, 'running'));
  }

  const task = toPrompt(parent.input);

  try {
    const orchestrated = shouldOrchestrate(task, threshold);
    const plan: OrchestrationPlan = orchestrated
      ? await planner.plan({ task })
      : {
          subtasks: [
            { id: 'single', agentType: defaultAgentType, prompt: task, dependsOn: [] },
          ],
        };

    await repo.audit({
      orgId: parent.orgId,
      runId: parentRunId,
      actor: 'orchestrator',
      action: orchestrated ? 'orchestration.planned' : 'orchestration.single_agent',
      meta: {
        subtasks: plan.subtasks.map((s) => ({ id: s.id, agentType: s.agentType })),
      },
    });
    emit(deps.events, 'orchestration.planned', parentRunId, parent.orgId, {
      orchestrated,
      subtasks: plan.subtasks.map((s) => ({ id: s.id, agentType: s.agentType })),
    });

    const order = topoSort(plan.subtasks);
    const outputs: Record<string, unknown> = {};
    // Track each contributor so the aggregate is a readable, attributed team
    // report (Doc-2 "structured team responses") rather than raw nested JSON.
    const contributions: TeamContribution[] = [];

    for (const subtask of order) {
      const childAgent = await repo.findAgentByType(parent.orgId, subtask.agentType);
      if (!childAgent) {
        throw new Error(
          `No agent of type "${subtask.agentType}" available in org ${parent.orgId}`,
        );
      }

      const childRunId = `${parentRunId}::${subtask.id}`;
      await repo.createRun({
        id: childRunId,
        orgId: parent.orgId,
        agentId: childAgent.id,
        status: 'queued',
        input: {
          prompt: composePrompt(subtask, outputs),
          parentRunId,
          subtaskId: subtask.id,
        },
        attempts: 0,
        parentRunId,
      });

      // Live "assembly graph": emit subtask lifecycle on the PARENT run stream.
      emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
        subtaskId: subtask.id,
        agentType: subtask.agentType,
        agentName: childAgent.name,
        status: 'running',
      });

      // Child agents are never orchestrators. Either run inline, or (production)
      // dispatch onto the queue and await completion via the event bus.
      try {
        await runChild(deps, childRunId);
      } catch (err) {
        emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
          subtaskId: subtask.id,
          agentType: subtask.agentType,
          agentName: childAgent.name,
          status: 'failed',
        });
        throw err;
      }

      const child = await repo.getRun(childRunId);
      if (!child || child.status !== 'succeeded') {
        throw new Error(
          `Subtask "${subtask.id}" did not succeed (status=${child?.status ?? 'missing'})`,
        );
      }
      outputs[subtask.id] = child.output;
      contributions.push({
        subtaskId: subtask.id,
        agentType: subtask.agentType,
        agentName: childAgent.name,
        output: child.output,
      });
      emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
        subtaskId: subtask.id,
        agentType: subtask.agentType,
        agentName: childAgent.name,
        status: 'succeeded',
      });
    }

    // Collective-thinking pass (Doc-2): after the team produces a synthesis, the
    // reviewer (Revisa) critiques the combined work and gives a ship/revise
    // verdict. Only for genuinely orchestrated work (>1 subtask), only if the
    // plan didn't already end on a reviewer, and only if a reviewer agent exists.
    const lastId = order[order.length - 1].id;
    let review: TeamContribution | undefined;
    const planHasReviewer = plan.subtasks.some((s) => s.agentType === 'reviewer');
    if (orchestrated && contributions.length > 1 && !planHasReviewer) {
      const reviewer = await repo.findAgentByType(parent.orgId, 'reviewer');
      if (reviewer) {
        const reviewRunId = `${parentRunId}::review`;
        await repo.createRun({
          id: reviewRunId,
          orgId: parent.orgId,
          agentId: reviewer.id,
          status: 'queued',
          input: { prompt: reviewPrompt(task, contributions), parentRunId, subtaskId: 'review' },
          attempts: 0,
          parentRunId,
        });
        emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
          subtaskId: 'review',
          agentType: 'reviewer',
          agentName: reviewer.name,
          status: 'running',
        });
        await runChild(deps, reviewRunId);
        const reviewRun = await repo.getRun(reviewRunId);
        if (reviewRun?.status === 'succeeded') {
          review = {
            subtaskId: 'review',
            agentType: 'reviewer',
            agentName: reviewer.name,
            output: reviewRun.output,
          };
          emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
            subtaskId: 'review',
            agentType: 'reviewer',
            agentName: reviewer.name,
            status: 'succeeded',
          });
        }
        // A failed review is non-fatal: the team's answer still stands.
      }
    }

    // Revision round (Doc-2, closes the loop): when the reviewer's verdict asks
    // for rework, the synthesis agent revises its output against the critique —
    // one round only, deterministic id, non-fatal on failure.
    let summary = outputs[lastId];
    if (review && verdictNeedsRework(review.output)) {
      const synthSubtask = order[order.length - 1];
      const synthAgent = await repo.findAgentByType(parent.orgId, synthSubtask.agentType);
      if (synthAgent) {
        const revRunId = `${parentRunId}::rev1`;
        await repo.createRun({
          id: revRunId,
          orgId: parent.orgId,
          agentId: synthAgent.id,
          status: 'queued',
          input: {
            prompt: revisionPrompt(task, summary, review.output),
            parentRunId,
            subtaskId: 'rev1',
          },
          attempts: 0,
          parentRunId,
        });
        emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
          subtaskId: 'rev1',
          agentType: synthSubtask.agentType,
          agentName: synthAgent.name,
          status: 'running',
        });
        try {
          await runChild(deps, revRunId);
          const revRun = await repo.getRun(revRunId);
          if (revRun?.status === 'succeeded') {
            summary = revRun.output;
            contributions.push({
              subtaskId: 'rev1',
              agentType: synthSubtask.agentType,
              agentName: synthAgent.name,
              output: revRun.output,
            });
            emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
              subtaskId: 'rev1',
              agentType: synthSubtask.agentType,
              agentName: synthAgent.name,
              status: 'succeeded',
            });
          }
        } catch {
          // Non-fatal: ship the pre-revision answer with the critique attached.
        }
      }
    }

    // Aggregate: the last subtask in topological order is treated as the
    // synthesis/summary (replaced by the revision when one ran); all subtask
    // outputs are retained. The `report` field is a human-facing, attributed
    // team write-up of who did what (Doc-2), with the reviewer's critique.
    const aggregated = {
      summary,
      report: buildTeamReport(task, contributions, review),
      contributions,
      review: review?.output,
      subtasks: outputs,
    };

    await repo.updateRunStatus(parentRunId, transition('running', 'succeeded'), {
      output: aggregated,
    });
    await repo.audit({
      orgId: parent.orgId,
      runId: parentRunId,
      actor: 'orchestrator',
      action: 'orchestration.succeeded',
      meta: { subtasks: plan.subtasks.length },
    });
    emit(deps.events, 'run.succeeded', parentRunId, parent.orgId, {
      subtasks: plan.subtasks.length,
    });
  } catch (err) {
    // Mirror runtime semantics: leave the parent 'running' and rethrow so the
    // worker owns the terminal failed/DLQ transition.
    const message = err instanceof Error ? err.message : String(err);
    await repo.updateRunStatus(parentRunId, 'running', { error: message });
    await repo.audit({
      orgId: parent.orgId,
      runId: parentRunId,
      actor: 'orchestrator',
      action: 'orchestration.attempt_failed',
      meta: { error: message },
    });
    throw err;
  }
}

// Run a child subtask: inline (default) or via the queue + event bus (production).
async function runChild(deps: OrchestratorDeps, childRunId: string): Promise<void> {
  if (!deps.asyncChildren || !deps.queue || !deps.events) {
    await executeRun(childRunId, deps);
    return;
  }
  const bus = deps.events;
  const done = new Promise<void>((resolve, reject) => {
    const off = bus.subscribe(childRunId, (e) => {
      if (e.type === 'run.succeeded') {
        off();
        resolve();
      } else if (e.type === 'run.dead_lettered') {
        off();
        reject(new Error(`subtask run ${childRunId} did not succeed`));
      }
    });
  });
  await deps.queue.enqueue({ runId: childRunId });
  await done;
}

function composePrompt(
  subtask: OrchestrationSubtask,
  outputs: Record<string, unknown>,
): string {
  if (subtask.dependsOn.length === 0) return subtask.prompt;
  const context = subtask.dependsOn
    .map((id) => `- ${id}: ${stringify(outputs[id])}`)
    .join('\n');
  return `${subtask.prompt}\n\nContext from prior subtasks:\n${context}`;
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export interface TeamContribution {
  subtaskId: string;
  agentType: AgentType;
  agentName: string;
  output: unknown;
}

// Role labels for the attributed team report (Russian UI).
const ROLE_LABEL: Record<AgentType, string> = {
  orchestrator: 'Координатор',
  researcher: 'Исследователь',
  analyst: 'Аналитик',
  writer: 'Райтер',
  coder: 'Инженер',
  reviewer: 'Ревьюер',
};

// Render an attributed, readable team write-up: a synthesis up top, then each
// agent's contribution under its own heading, and (when present) the reviewer's
// critique. This is what the user reads as "the team's answer", instead of raw
// nested JSON.
export function buildTeamReport(
  task: string,
  contributions: TeamContribution[],
  review?: TeamContribution,
): string {
  if (contributions.length === 0) return '';
  const synthesis = contributions[contributions.length - 1];
  const lines: string[] = [];
  lines.push('## Ответ команды');
  lines.push('');
  lines.push(stringify(synthesis.output).trim());
  if (contributions.length > 1) {
    lines.push('');
    lines.push('---');
    lines.push('### Вклад участников');
    for (const c of contributions) {
      const label = ROLE_LABEL[c.agentType] ?? c.agentType;
      lines.push('');
      lines.push(`**${c.agentName} · ${label}**`);
      lines.push(stringify(c.output).trim());
    }
  }
  if (review) {
    lines.push('');
    lines.push('---');
    lines.push(`### Ревью · ${review.agentName} (${ROLE_LABEL.reviewer})`);
    lines.push(stringify(review.output).trim());
  }
  return lines.join('\n');
}

// Verdict detection for the revision round. The reviewer is instructed to end
// with exactly one of «Готово к выпуску» / «Нужны доработки: …»; rework only
// when the rework phrase appears WITHOUT the ship phrase (ambiguous output —
// e.g. both quoted — ships as-is rather than burning an extra round).
export function verdictNeedsRework(reviewOutput: unknown): boolean {
  const text = typeof reviewOutput === 'string' ? reviewOutput : JSON.stringify(reviewOutput ?? '');
  const lower = text.toLowerCase();
  return lower.includes('нужны доработки') && !lower.includes('готово к выпуску');
}

// Prompt for the one revision round: the synthesis agent reworks its own output
// against the reviewer's critique.
export function revisionPrompt(task: string, synthesis: unknown, critique: unknown): string {
  return [
    `Исходная задача: ${task}`,
    '',
    'Твой текущий вариант ответа:',
    '"""',
    stringify(synthesis),
    '"""',
    '',
    'Ревьюер запросил доработки:',
    '"""',
    stringify(critique),
    '"""',
    '',
    'Доработай ответ по замечаниям ревьюера и выдай финальную версию целиком.',
  ].join('\n');
}

// Prompt for the reviewer's collective-thinking pass: critique the team's
// combined work against the original task and end with a clear verdict.
export function reviewPrompt(task: string, contributions: TeamContribution[]): string {
  const body = contributions
    .map((c) => {
      const label = ROLE_LABEL[c.agentType] ?? c.agentType;
      return `### ${c.agentName} (${label})\n${stringify(c.output)}`;
    })
    .join('\n\n');
  return [
    `Исходная задача: ${task}`,
    '',
    'Ниже — работа команды. Кратко и по делу: укажи пробелы, риски и неточности,',
    'затем дай вердикт одной строкой: «Готово к выпуску» или «Нужны доработки: …».',
    '',
    body,
  ].join('\n');
}
