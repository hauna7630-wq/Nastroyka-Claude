// Task decomposition (review §4.2): turn a task into a typed-agent subtask graph.
//
// Two implementations:
//   - StaticPlanner: a fixed plan, for tests and deterministic flows.
//   - ModelPlanner: asks the model for a JSON plan (works with the mock provider
//     in tests, real Claude in production).

import { ModelProvider } from '../ports/model';
import { AgentType } from '../domain/types';

export interface OrchestrationSubtask {
  id: string;
  agentType: AgentType;
  prompt: string;
  dependsOn: string[];
}

export interface OrchestrationPlan {
  subtasks: OrchestrationSubtask[];
}

export interface Planner {
  plan(args: { task: string }): Promise<OrchestrationPlan>;
}

const AGENT_TYPES: ReadonlySet<AgentType> = new Set<AgentType>([
  'researcher',
  'writer',
  'analyst',
  'coder',
  'orchestrator',
  'reviewer',
]);

export class InvalidPlanError extends Error {
  constructor(message: string) {
    super(`Invalid orchestration plan: ${message}`);
    this.name = 'InvalidPlanError';
  }
}

/** Fixed plan, useful for tests and simple deterministic workflows. */
export class StaticPlanner implements Planner {
  constructor(private readonly fixed: OrchestrationPlan) {}
  async plan(): Promise<OrchestrationPlan> {
    return normalizePlan(this.fixed);
  }
}

export const PLANNER_SYSTEM_PROMPT = [
  'You are an orchestrator that decomposes a task into a small set of subtasks,',
  'each assigned to a typed agent. Respond ONLY with JSON of the shape:',
  '{"subtasks":[{"id":"s1","agentType":"researcher","prompt":"...","dependsOn":[]}]}.',
  'agentType must be one of: researcher, writer, analyst, coder, reviewer.',
  'Use dependsOn to express ordering between subtask ids.',
].join(' ');

export class ModelPlanner implements Planner {
  constructor(private readonly model: ModelProvider) {}

  async plan({ task }: { task: string }): Promise<OrchestrationPlan> {
    const turn = await this.model.complete({
      system: PLANNER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: task }],
      tools: [],
    });
    const raw = extractJson(turn.text ?? '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new InvalidPlanError('model did not return parseable JSON');
    }
    return normalizePlan(parsed);
  }
}

// Pull the first balanced {...} block out of a model response.
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new InvalidPlanError('no JSON object found in model output');
  }
  return text.slice(start, end + 1);
}

export function normalizePlan(input: unknown): OrchestrationPlan {
  if (!input || typeof input !== 'object' || !Array.isArray((input as any).subtasks)) {
    throw new InvalidPlanError('missing subtasks array');
  }
  const subtasks: OrchestrationSubtask[] = (input as any).subtasks.map(
    (s: any, i: number) => {
      const id = String(s?.id ?? `s${i + 1}`);
      const agentType = s?.agentType as AgentType;
      if (!AGENT_TYPES.has(agentType) || agentType === 'orchestrator') {
        throw new InvalidPlanError(`subtask ${id} has invalid agentType "${s?.agentType}"`);
      }
      return {
        id,
        agentType,
        prompt: String(s?.prompt ?? ''),
        dependsOn: Array.isArray(s?.dependsOn) ? s.dependsOn.map(String) : [],
      };
    },
  );
  if (subtasks.length === 0) throw new InvalidPlanError('plan has no subtasks');

  const ids = new Set(subtasks.map((s) => s.id));
  if (ids.size !== subtasks.length) throw new InvalidPlanError('duplicate subtask ids');
  for (const s of subtasks) {
    for (const dep of s.dependsOn) {
      if (!ids.has(dep)) throw new InvalidPlanError(`subtask ${s.id} depends on unknown ${dep}`);
    }
  }
  return { subtasks };
}

/** Kahn topological sort; throws on cycles. */
export function topoSort(subtasks: OrchestrationSubtask[]): OrchestrationSubtask[] {
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const s of subtasks) indegree.set(s.id, 0);
  for (const s of subtasks) {
    for (const dep of s.dependsOn) {
      indegree.set(s.id, (indegree.get(s.id) ?? 0) + 1);
      dependents.set(dep, [...(dependents.get(dep) ?? []), s.id]);
    }
  }
  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: OrchestrationSubtask[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(byId.get(id)!);
    for (const next of dependents.get(id) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== subtasks.length) {
    throw new InvalidPlanError('dependency cycle detected');
  }
  return order;
}
