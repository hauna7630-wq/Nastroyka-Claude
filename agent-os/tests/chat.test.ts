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
const AGENT: Agent = { id: 'agent_1', orgId: 'org_1', name: 'Iskara — Исследователь', type: 'researcher', systemPrompt: 'sys' };

// Echoes the last user line so we can assert dialog context threading.
class EchoModel implements ModelProvider {
  async complete(args: { messages: { role: string; content: string }[] }): Promise<ModelTurn> {
    const last = [...args.messages].reverse().find((m) => m.role === 'user');
    return { ...finalTurn('ECHO::' + (last?.content ?? '')) };
  }
}
class FailModel implements ModelProvider {
  async complete(): Promise<ModelTurn> {
    throw new Error('claude CLI timed out');
  }
}

function build(model: ModelProvider, maxAttempts = 1) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent({ ...AGENT });
  const events = new InMemoryEventBus();
  const observability = new Observability(repo);
  const queue = new InMemoryQueue({ maxAttempts });
  startWorker({
    queue, repo, model, tools: new ToolRegistry(), allowlistDomains: [], events,
    planner: new StaticPlanner({ subtasks: [{ id: 's', agentType: 'researcher', prompt: 'x', dependsOn: [] }] }),
    complexityThreshold: 999, defaultAgentType: 'researcher',
  });
  const cp = new ControlPlane({ repo, queue, observability, events });
  return { repo, queue, cp };
}

describe('Personal chat — dialog memory', () => {
  it('persists the user message, runs, and backfills the agent reply on read', async () => {
    const { cp } = build(new EchoModel());
    const sent = await cp.sendChatMessage({ orgId: 'org_1', agentId: 'agent_1', text: 'привет' });
    expect(sent.runId).toBeTruthy();
    expect(sent.message.role).toBe('user');

    const hist = await cp.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' });
    expect(hist.messages.map((m) => m.role)).toEqual(['user', 'agent']);
    expect(hist.messages[1].text).toContain('ECHO::');
    expect(hist.pending).toHaveLength(0);
  });

  it('threads prior dialog into the next run prompt', async () => {
    const { cp, repo } = build(new EchoModel());
    await cp.sendChatMessage({ orgId: 'org_1', agentId: 'agent_1', text: 'первый вопрос' });
    await cp.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' }); // backfill reply
    const second = await cp.sendChatMessage({ orgId: 'org_1', agentId: 'agent_1', text: 'второй вопрос' });
    const run = await repo.getRun(second.runId);
    const prompt = (run?.input as { prompt: string }).prompt;
    expect(prompt).toContain('Пользователь: первый вопрос');
    expect(prompt).toContain('второй вопрос');
  });

  it('backfills exactly once (idempotent) and survives a fresh ControlPlane', async () => {
    const { cp, repo, queue } = build(new EchoModel());
    await cp.sendChatMessage({ orgId: 'org_1', agentId: 'agent_1', text: 'q' });
    await cp.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' });
    await cp.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' });
    const direct = await repo.listChatMessages('org_1', 'agent_1');
    expect(direct.filter((m) => m.role === 'agent')).toHaveLength(1);

    // "Across sessions": a brand-new ControlPlane over the same repo sees the thread.
    const cp2 = new ControlPlane({ repo, queue, observability: new Observability(repo), events: new InMemoryEventBus() });
    const again = await cp2.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' });
    expect(again.messages).toHaveLength(2);
  });

  it('reports a failed run as pending with an honest reason (no reply row)', async () => {
    const { cp } = build(new FailModel(), 1);
    await cp.sendChatMessage({ orgId: 'org_1', agentId: 'agent_1', text: 'boom' });
    const hist = await cp.getChatHistory({ orgId: 'org_1', agentId: 'agent_1' });
    expect(hist.messages.filter((m) => m.role === 'agent')).toHaveLength(0);
    expect(hist.pending).toHaveLength(1);
    expect(hist.pending[0].status).toBe('failed');
    expect(hist.pending[0].errorHuman).toMatch(/таймаут/i);
  });

  it('composes an attachment into the prompt but keeps the thread text short', async () => {
    const { cp, repo } = build(new EchoModel());
    const sent = await cp.sendChatMessage({
      orgId: 'org_1', agentId: 'agent_1', text: 'разбери',
      attachment: { filename: 'data.csv', text: 'a,b\n1,2' },
    });
    expect(sent.message.text).toBe('разбери 📎 data.csv');
    const run = await repo.getRun(sent.runId);
    expect((run?.input as { prompt: string }).prompt).toContain('Файл "data.csv"');
  });
});
