// Deterministic, offline planner for the dev Coordinator. Decomposes any task
// into a fixed researcher -> analyst -> writer chain (a typed-agent "team").
// Production uses ModelPlanner (a real LLM) instead.

import { Planner, OrchestrationPlan, normalizePlan } from '../orchestrator/planner';

export class HeuristicPlanner implements Planner {
  async plan({ task }: { task: string }): Promise<OrchestrationPlan> {
    return normalizePlan({
      subtasks: [
        { id: 'research', agentType: 'researcher', prompt: `Собери информацию по задаче: ${task}`, dependsOn: [] },
        { id: 'analyze', agentType: 'analyst', prompt: `Проанализируй собранное по задаче: ${task}`, dependsOn: ['research'] },
        { id: 'write', agentType: 'writer', prompt: `Напиши итоговый результат по задаче: ${task}`, dependsOn: ['analyze'] },
      ],
    });
  }
}
