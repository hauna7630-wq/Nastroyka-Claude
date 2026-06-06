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
      emit(deps.events, 'orchestration.subtask', parentRunId, parent.orgId, {
        subtaskId: subtask.id,
        agentType: subtask.agentType,
        agentName: childAgent.name,
        status: 'succeeded',
      });
    }

    // Aggregate: the last subtask in topological order is treated as the
    // synthesis/summary; all subtask outputs are retained.
    const lastId = order[order.length - 1].id;
    const aggregated = { summary: outputs[lastId], subtasks: outputs };

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
