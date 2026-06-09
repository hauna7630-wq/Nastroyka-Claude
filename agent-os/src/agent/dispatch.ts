// Run dispatcher: routes a run to the single-agent runtime or the multi-agent
// orchestrator based on the run's agent type. This is the single entrypoint the
// execution-plane worker uses.

import { executeRun, RunNotFoundError, RuntimeDeps } from './runtime';
import { executeOrchestration } from '../orchestrator/orchestrator';
import { AgentType } from '../domain/types';
import { Planner } from '../orchestrator/planner';
import { Queue } from '../ports/queue';

export interface DispatchDeps extends RuntimeDeps {
  // Required only when orchestrator-type runs are dispatched.
  planner?: Planner;
  complexityThreshold?: number;
  defaultAgentType?: AgentType;
  // Production: orchestrator dispatches children via the queue + event bus.
  asyncChildren?: boolean;
  queue?: Queue;
}

export async function dispatchRun(runId: string, deps: DispatchDeps): Promise<void> {
  const run = await deps.repo.getRun(runId);
  if (!run) throw new RunNotFoundError(runId);
  const agent = await deps.repo.getAgent(run.agentId);
  if (!agent) throw new Error(`Agent not found: ${run.agentId}`);

  if (agent.type === 'orchestrator') {
    if (!deps.planner) {
      throw new Error('Orchestrator run dispatched without a planner');
    }
    return executeOrchestration(runId, { ...deps, planner: deps.planner });
  }
  return executeRun(runId, deps);
}
