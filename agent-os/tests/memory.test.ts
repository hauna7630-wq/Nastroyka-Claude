import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { RepositoryMemoryStore } from '../src/adapters/memory.repo';
import { Ledger } from '../src/billing/ledger';
import { ToolRegistry } from '../src/tools/registry';
import { executeRun } from '../src/agent/runtime';
import { finalTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org, Run } from '../src/domain/types';

const ORG: Org = { id: 'org_1', name: 'Acme', creditBalance: 100 };
const AGENT: Agent = {
  id: 'agent_1',
  orgId: 'org_1',
  name: 'Researcher',
  type: 'researcher',
  systemPrompt: 'base prompt',
};

// Records the system prompt it was handed, so we can assert memory injection.
class CapturingModel implements ModelProvider {
  public system = '';
  async complete(args: { system: string }): Promise<ModelTurn> {
    this.system = args.system;
    return { ...finalTurn('done') };
  }
}

describe('Memory recall (lexical, MVP)', () => {
  it('ranks by relevance and excludes short-term memory unless run-scoped', async () => {
    const repo = new InMemoryRepository();
    const store = new RepositoryMemoryStore(repo);
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'The project is written in TypeScript and Prisma.' });
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'The customer prefers email over phone.' });
    await store.remember({ agentId: 'a', kind: 'short_term', runId: 'run_x', content: 'scratchpad for run x' });

    const hits = await store.recall('a', { query: 'what language is the project written in' });
    expect(hits).toHaveLength(1);
    expect(hits[0].content).toContain('TypeScript');

    // short_term hidden without a runId, visible when scoped.
    const noScope = await store.recall('a', { kinds: ['short_term'] });
    expect(noScope).toHaveLength(0);
    const scoped = await store.recall('a', { kinds: ['short_term'], runId: 'run_x' });
    expect(scoped).toHaveLength(1);
  });

  it('falls back to recency when there is no query', async () => {
    const repo = new InMemoryRepository();
    const store = new RepositoryMemoryStore(repo);
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'older', createdAt: 1 });
    await store.remember({ agentId: 'a', kind: 'long_term', content: 'newer', createdAt: 2 });
    const hits = await store.recall('a', { limit: 1 });
    expect(hits[0].content).toBe('newer');
  });
});

describe('Memory in the runtime', () => {
  async function setup() {
    const repo = new InMemoryRepository();
    repo.seedOrg({ ...ORG });
    repo.seedAgent({ ...AGENT });
    const memory = new RepositoryMemoryStore(repo);
    const model = new CapturingModel();
    const deps = {
      repo,
      model,
      tools: new ToolRegistry(),
      ledger: new Ledger(repo),
      allowlistDomains: [],
      memory,
    };
    return { repo, memory, model, deps };
  }

  function run(id: string, prompt: string): Run {
    return {
      id,
      orgId: 'org_1',
      agentId: 'agent_1',
      status: 'queued',
      input: { prompt },
      creditsUsed: 0,
      attempts: 0,
    };
  }

  it('injects recalled memory into the system prompt and writes an episodic summary', async () => {
    const { repo, memory, model, deps } = await setup();
    await memory.remember({
      agentId: 'agent_1',
      kind: 'long_term',
      content: 'The project language is TypeScript.',
    });
    await repo.createRun(run('run_1', 'Which language is the project in?'));

    await executeRun('run_1', deps);

    expect(model.system).toContain('# Relevant memory');
    expect(model.system).toContain('TypeScript');

    const episodic = await repo.listMemories('agent_1', ['episodic']);
    expect(episodic).toHaveLength(1);
    expect(episodic[0].runId).toBe('run_1');
  });

  it('recalls a prior run\'s episodic memory on a later, related run', async () => {
    const { repo, memory, model, deps } = await setup();
    await repo.createRun(run('run_1', 'Summarize the quarterly sales report'));
    await executeRun('run_1', deps);

    await repo.createRun(run('run_2', 'Follow up on the quarterly sales report'));
    await executeRun('run_2', deps);

    // The 2nd run's prompt should have been augmented with run_1's episodic memory.
    expect(model.system).toContain('# Relevant memory');
    expect(model.system).toContain('quarterly sales report');
  });
});
