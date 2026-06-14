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
    let orchestrated = shouldOrchestrate(task, threshold);
    const singlePlan: OrchestrationPlan = {
      subtasks: [
        { id: 'single', agentType: defaultAgentType, prompt: task, dependsOn: [] },
      ],
    };
    let plan: OrchestrationPlan = singlePlan;
    if (orchestrated) {
      // Planner robustness: the model sometimes answers conversationally
      // instead of emitting a JSON plan (e.g. a chatty/ambiguous task). That
      // must NOT fail the run — fall back to the single-agent path so an agent
      // still picks the task up.
      try {
        plan = await planner.plan({ task });
      } catch (err) {
        orchestrated = false;
        plan = singlePlan;
        await repo.audit({
          orgId: parent.orgId,
          runId: parentRunId,
          actor: 'orchestrator',
          action: 'orchestration.plan_fallback',
          meta: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

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

    // Partial-failure tolerance: a single subtask that times out or errors must
    // NOT throw the whole task away (the user would see only a half-finished
    // discussion and no result). We record the failure as an attributed
    // contribution, skip dependents that lost their input, and still aggregate a
    // partial deliverable from whoever finished. Only a total wipe-out throws.
    const failedIds = new Set<string>();
    for (const subtask of order) {
      const childAgent = await repo.findAgentByType(parent.orgId, subtask.agentType);
      if (!childAgent) {
        failedIds.add(subtask.id);
        contributions.push({
          subtaskId: subtask.id,
          agentType: subtask.agentType,
          agentName: subtask.agentType,
          output: `В команде нет агента типа "${subtask.agentType}" — подзадача пропущена.`,
          failed: true,
        });
        continue;
      }

      const childRunId = `${parentRunId}::${subtask.id}`;
      // No upstream output → can't do meaningful work; mark skipped, don't run.
      const depFailed = subtask.dependsOn.some((d) => failedIds.has(d));

      await repo.createRun({
        id: childRunId,
        orgId: parent.orgId,
        agentId: childAgent.id,
        status: 'queued',
        input: {
          prompt: composePrompt(subtask, outputs),
          parentRunId,
          subtaskId: subtask.id,
          stream: true,
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

      let ok = false;
      if (!depFailed) {
        try {
          await runChild(deps, childRunId, {
            parentRunId,
            subtaskId: subtask.id,
            agentType: subtask.agentType,
            agentName: childAgent.name,
          });
          const child = await repo.getRun(childRunId);
          if (child && child.status === 'succeeded') {
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
            ok = true;
          }
        } catch {
          // non-fatal: fall through to the failed branch below
        }
      }
      if (!ok) {
        failedIds.add(subtask.id);
        contributions.push({
          subtaskId: subtask.id,
          agentType: subtask.agentType,
          agentName: childAgent.name,
          output: depFailed
            ? 'Пропущено: не выполнилась подзадача, от которой это зависело.'
            : 'Подзадача не выполнилась (таймаут или ошибка модели).',
          failed: true,
        });
        emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
          subtaskId: subtask.id,
          agentType: subtask.agentType,
          agentName: childAgent.name,
          status: 'failed',
        });
      }
    }

    // Total failure only when NOTHING succeeded — then surface the honest error
    // (the worker turns it into a retryable DLQ entry). Otherwise we ship partial.
    const okContribs = contributions.filter((c) => !c.failed);
    if (okContribs.length === 0) {
      throw new Error('Ни одна подзадача команды не выполнилась');
    }

    // Collective-thinking debate (Doc-2): the reviewer (Revisa) critiques the
    // team's synthesis and gives a ship/revise verdict; on "rework" the synthesis
    // agent revises and the reviewer re-reviews — up to DEBATE_ROUNDS times or
    // until "Готово к выпуску". All rounds are attributed; deterministic ids
    // (::review / ::review2… and ::rev1 / ::rev2…); every round is non-fatal.
    // Synthesis = the last agent that actually SUCCEEDED (a failed tail subtask
    // must not become the summary or the thing the reviewer critiques).
    const lastOk = okContribs[okContribs.length - 1];
    let summary = lastOk.output;
    let review: TeamContribution | undefined;
    const planHasReviewer = plan.subtasks.some((s) => s.agentType === 'reviewer');
    const debate = orchestrated && okContribs.length > 1 && !planHasReviewer;
    if (debate) {
      const reviewer = await repo.findAgentByType(parent.orgId, 'reviewer');
      const synthAgent = await repo.findAgentByType(parent.orgId, lastOk.agentType);
      if (reviewer) {
        for (let round = 1; round <= DEBATE_ROUNDS; round++) {
          const reviewId = round === 1 ? 'review' : `review${round}`;
          // The reviewer critique is tracked separately (the report renders the
          // latest review in its own section); the full debate — every review and
          // revision round — is visible via child runs in the team view.
          const r = await runChildContribution(deps, parent.orgId, parentRunId, reviewId, reviewer, {
            prompt: reviewPrompt(task, contributions),
            agentType: 'reviewer',
          });
          if (!r) break; // failed review is non-fatal; keep what we have
          review = r;
          if (!verdictNeedsRework(r.output) || !synthAgent) break; // shipped, or no one to revise

          const revId = `rev${round}`;
          const rev = await runChildContribution(deps, parent.orgId, parentRunId, revId, synthAgent, {
            prompt: revisionPrompt(task, summary, r.output),
            agentType: lastOk.agentType,
          });
          if (!rev) break;
          summary = rev.output;
          contributions.push(rev); // revision replaces the synthesis in the report
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

// Max review↔revise iterations in the collective-thinking debate (Doc-2).
// Tunable via env; bounded so a stubborn reviewer can't loop forever.
const DEBATE_ROUNDS = Math.max(1, Math.min(5, Number(process.env.DEBATE_ROUNDS ?? 2)));

// Create + run one attributed debate child (review or revision), emitting the
// running/succeeded lifecycle events. Returns the contribution, or undefined if
// the child didn't succeed (non-fatal — the caller keeps the prior answer).
async function runChildContribution(
  deps: OrchestratorDeps,
  orgId: string,
  parentRunId: string,
  subtaskId: string,
  agent: { id: string; name: string },
  spec: { prompt: string; agentType: AgentType },
): Promise<TeamContribution | undefined> {
  const childRunId = `${parentRunId}::${subtaskId}`;
  await deps.repo.createRun({
    id: childRunId,
    orgId,
    agentId: agent.id,
    status: 'queued',
    input: { prompt: spec.prompt, parentRunId, subtaskId, stream: true },
    attempts: 0,
    parentRunId,
  });
  emit(deps.events, 'orchestration.subtask', parentRunId, orgId, {
    subtaskId,
    agentType: spec.agentType,
    agentName: agent.name,
    status: 'running',
  });
  try {
    await runChild(deps, childRunId, {
      parentRunId,
      subtaskId,
      agentType: spec.agentType,
      agentName: agent.name,
    });
  } catch {
    return undefined; // non-fatal
  }
  const run = await deps.repo.getRun(childRunId);
  if (run?.status !== 'succeeded') return undefined;
  emit(deps.events, 'orchestration.subtask', parentRunId, orgId, {
    subtaskId,
    agentType: spec.agentType,
    agentName: agent.name,
    status: 'succeeded',
  });
  return { subtaskId, agentType: spec.agentType, agentName: agent.name, output: run.output };
}

interface ChildMeta {
  parentRunId: string;
  subtaskId: string;
  agentType: AgentType;
  agentName: string;
}

// Bridge a child's live tokens onto the PARENT run stream so the team-discussion
// panel can render each agent typing. The child emits `run.token` under its own
// runId; we re-emit under the parent runId, tagged with subtask/agent metadata.
// Best-effort: returns an unsubscribe fn (no-op when events/meta absent).
function bridgeChildTokens(deps: OrchestratorDeps, childRunId: string, meta?: ChildMeta): () => void {
  if (!deps.events || !meta) return () => {};
  const bus = deps.events;
  const off = bus.subscribe(childRunId, (e) => {
    if (e.type !== 'run.token') return;
    const text = (e.data as { text?: unknown })?.text;
    if (typeof text !== 'string' || !text) return;
    emit(bus, 'run.token', meta.parentRunId, e.orgId, {
      text,
      subtaskId: meta.subtaskId,
      agentName: meta.agentName,
      agentType: meta.agentType,
    });
  });
  return off;
}

// Run a child subtask: inline (default) or via the queue + event bus (production).
async function runChild(
  deps: OrchestratorDeps,
  childRunId: string,
  meta?: ChildMeta,
): Promise<void> {
  if (!deps.asyncChildren || !deps.queue || !deps.events) {
    const off = bridgeChildTokens(deps, childRunId, meta);
    try {
      await executeRun(childRunId, deps);
    } finally {
      off();
    }
    return;
  }
  const bus = deps.events;
  const offTokens = bridgeChildTokens(deps, childRunId, meta);
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
  try {
    await deps.queue.enqueue({ runId: childRunId });
    await done;
  } finally {
    offTokens();
  }
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
  // Set when the subtask didn't succeed: the run still delivers a partial result
  // from the agents that did finish, instead of throwing the whole task away.
  failed?: boolean;
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
  // Synthesis is the last agent that actually succeeded — never a failed subtask.
  const succeeded = contributions.filter((c) => !c.failed);
  const synthesis = succeeded[succeeded.length - 1] ?? contributions[contributions.length - 1];
  const anyFailed = contributions.some((c) => c.failed);
  const lines: string[] = [];
  lines.push('## Ответ команды');
  if (anyFailed) {
    lines.push('');
    lines.push('> ⚠️ Частичный результат: часть подзадач не выполнилась — собрано из того, что успели агенты.');
  }
  lines.push('');
  lines.push(stringify(synthesis.output).trim());
  if (contributions.length > 1) {
    lines.push('');
    lines.push('---');
    lines.push('### Вклад участников');
    for (const c of contributions) {
      const label = ROLE_LABEL[c.agentType] ?? c.agentType;
      lines.push('');
      lines.push(`**${c.agentName} · ${label}**${c.failed ? ' — ⚠️ не выполнено' : ''}`);
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
