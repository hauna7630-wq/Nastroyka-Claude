import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, AgentType, Org, Run } from '../src/domain/types';
import { StaticPlanner } from '../src/orchestrator/planner';
import { ControlPlane } from '../src/api/controlPlane';
import { Observability } from '../src/observability/metrics';
import { deriveTeamPhase } from '../src/orchestrator/phase';

const ORG: Org = { id: 'o', name: 'Acme' };
function agent(id: string, type: AgentType, name?: string): Agent {
  return { id, orgId: 'o', name: name ?? id, type, systemPrompt: 'p' };
}
function run(id: string, status: Run['status'], input: unknown = {}, parentRunId?: string): Run {
  return { id, orgId: 'o', agentId: 'x', status, input, attempts: 0, parentRunId };
}

describe('deriveTeamPhase', () => {
  const parentRunning = run('p', 'running');
  it('maps parent/children states to lifecycle phases', () => {
    expect(deriveTeamPhase(run('p', 'queued'), [])).toBe('new');
    expect(deriveTeamPhase(parentRunning, [])).toBe('analyzing');
    expect(deriveTeamPhase(parentRunning, [run('p::r', 'running', { subtaskId: 'r' }, 'p')])).toBe('working');
    expect(deriveTeamPhase(parentRunning, [run('p::review', 'running', { subtaskId: 'review' }, 'p')])).toBe('reviewing');
    expect(deriveTeamPhase(parentRunning, [run('p::review2', 'running', { subtaskId: 'review2' }, 'p')])).toBe('reviewing');
    expect(deriveTeamPhase(parentRunning, [run('p::rev1', 'queued', { subtaskId: 'rev1' }, 'p')])).toBe('revising');
    expect(deriveTeamPhase(parentRunning, [run('p::rev2', 'running', { subtaskId: 'rev2' }, 'p')])).toBe('revising');
    // An ordinary subtask that merely starts with "rev" is NOT a debate round.
    expect(deriveTeamPhase(parentRunning, [run('p::revenue', 'running', { subtaskId: 'revenue' }, 'p')])).toBe('working');
    expect(deriveTeamPhase(run('p', 'succeeded'), [])).toBe('completed');
    expect(deriveTeamPhase(run('p', 'failed'), [])).toBe('failed');
    expect(deriveTeamPhase(run('p', 'paused'), [])).toBe('needs_human');
  });
});

class EchoModel implements ModelProvider {
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    const last = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn('done:' + (last?.content ?? '').slice(0, 40)) };
  }
}

describe('GET /runs/:id/team (end-state over an orchestrated run)', () => {
  it('returns attributed children, discussion, review verdict, and phase', async () => {
    const repo = new InMemoryRepository();
    repo.seedOrg({ ...ORG });
    repo.seedAgent(agent('orch', 'orchestrator', 'Arkesha'));
    repo.seedAgent(agent('res', 'researcher', 'Iskara'));
    repo.seedAgent(agent('wri', 'writer', 'Slovena'));
    repo.seedAgent(agent('rev', 'reviewer', 'Revisa'));
    const events = new InMemoryEventBus();
    const queue = new InMemoryQueue({ maxAttempts: 2 });
    startWorker({
      queue, repo, model: new EchoModel(), tools: new ToolRegistry(), allowlistDomains: [], events,
      planner: new StaticPlanner({
        subtasks: [
          { id: 'r', agentType: 'researcher', prompt: 'research', dependsOn: [] },
          { id: 'w', agentType: 'writer', prompt: 'write', dependsOn: ['r'] },
        ],
      }),
      complexityThreshold: 5, defaultAgentType: 'researcher',
    });
    const cp = new ControlPlane({ repo, queue, observability: new Observability(repo), events });

    const { runId } = await cp.createRun({
      orgId: 'o', agentId: 'orch',
      input: { prompt: 'Research the market and then analyze and finally write a report.' },
    });

    const team = await cp.getRunTeam(runId);
    expect(team.phase).toBe('completed');
    expect(team.phaseLabel).toBe('ГОТОВО');
    expect(team.children.map((c) => c.subtaskId)).toEqual(['r', 'w', 'review']);
    expect(team.children[0].agentName).toBe('Iskara');
    expect(team.discussion.map((d) => d.kind)).toEqual(['contribution', 'contribution', 'review']);
    expect(team.review).toBeDefined();
  });
});
