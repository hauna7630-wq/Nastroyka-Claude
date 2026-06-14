import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus } from '../src/events/bus';
import { ToolRegistry } from '../src/tools/registry';
import { startWorker } from '../src/worker/worker';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org } from '../src/domain/types';
import { StaticPlanner } from '../src/orchestrator/planner';
import { ControlPlane } from '../src/api/controlPlane';
import { Observability } from '../src/observability/metrics';

const ORG: Org = { id: 'org_1', name: 'Acme' };
const ARKESHA: Agent = { id: 'orch_1', orgId: 'org_1', name: 'Arkesha — Координатор', type: 'orchestrator', systemPrompt: 's' };
const KODRIN: Agent = { id: 'coder_1', orgId: 'org_1', name: 'Kodrin — Разработчик', type: 'coder', systemPrompt: 's' };

class EchoModel implements ModelProvider {
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    const last = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn('ECHO::' + (last?.content ?? '')) };
  }
}

function build() {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...ARKESHA });
  repo.seedAgent({ ...KODRIN });
  const events = new InMemoryEventBus();
  const observability = new Observability(repo);
  const queue = new InMemoryQueue({ maxAttempts: 1 });
  startWorker({
    queue, repo, model: new EchoModel(), tools: new ToolRegistry(), allowlistDomains: [], events,
    planner: new StaticPlanner({ subtasks: [{ id: 's', agentType: 'coder', prompt: 'x', dependsOn: [] }] }),
    complexityThreshold: 999, defaultAgentType: 'coder',
  });
  const cp = new ControlPlane({ repo, queue, observability, events });
  return { repo, queue, cp };
}

describe('Delegation — coordinator hands a task to a named employee', () => {
  it('routes "поручи Kodrin: <task>" to Kodrin\'s inbox without running the current agent', async () => {
    const { cp } = build();
    const r = await cp.sendChatMessage({ orgId: 'org_1', agentId: 'orch_1', text: 'поручи Kodrin: написать парсер CSV' });
    expect(r.delegated).toBe(true);
    expect(r.to).toBe('Kodrin');
    expect(r.runId).toBe(''); // no LLM run for the current agent

    const inbox = await cp.listAssignments('org_1', 'coder_1');
    expect(inbox).toHaveLength(1);
    expect(inbox[0].task).toBe('написать парсер CSV');
    expect(inbox[0].from).toBe('Arkesha');
    expect(inbox[0].status).toBe('queued');
    expect(inbox[0].started).toBe(false);
  });

  it('does not delegate a plain message (normal chat run proceeds)', async () => {
    const { cp } = build();
    const r = await cp.sendChatMessage({ orgId: 'org_1', agentId: 'orch_1', text: 'привет, как дела?' });
    expect(r.delegated).toBeUndefined();
    expect(r.runId).toBeTruthy();
  });

  it('«Приступить» marks the assignment started and enqueues it', async () => {
    const { cp } = build();
    await cp.sendChatMessage({ orgId: 'org_1', agentId: 'orch_1', text: '@Kodrin собери отчёт' });
    const inbox = await cp.listAssignments('org_1', 'coder_1');
    const started = await cp.startAssignment({ orgId: 'org_1', runId: inbox[0].id });
    expect(started.runId).toBe(inbox[0].id);
    const after = await cp.listAssignments('org_1', 'coder_1');
    expect(after[0].started).toBe(true);
  });

  it('rejects starting a run that is not an assignment', async () => {
    const { cp } = build();
    const chat = await cp.sendChatMessage({ orgId: 'org_1', agentId: 'coder_1', text: 'обычный вопрос' });
    await expect(cp.startAssignment({ orgId: 'org_1', runId: chat.runId })).rejects.toThrow();
  });
});
