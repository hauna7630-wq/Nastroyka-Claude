import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { ToolRegistry } from '../src/tools/registry';
import { executeRun } from '../src/agent/runtime';
import { ToolNotAllowedError } from '../src/tools/registry';
import { RegexPiiMasker } from '../src/security/pii';
import { ScriptedModelProvider, toolCallTurn } from '../src/adapters/model.mock';
import { ModelProvider } from '../src/ports/model';
import { ModelTurn, Agent, Org, Run } from '../src/domain/types';

const ORG: Org = { id: 'org_1', name: 'Acme' };

function agent(extra: Partial<Agent> = {}): Agent {
  return { id: 'agent_1', orgId: 'org_1', name: 'A', type: 'researcher', systemPrompt: 'be helpful', ...extra };
}

async function setup(a: Agent, run: Partial<Run>, model: ModelProvider, pii = false) {
  const repo = new InMemoryRepository();
  repo.seedOrg({ ...ORG });
  repo.seedAgent(a);
  const full: Run = {
    id: 'run_1', orgId: 'org_1', agentId: a.id, status: 'queued', input: { prompt: 'hi' },
    attempts: 0, ...run,
  };
  await repo.createRun(full);
  const deps = {
    repo, model, tools: new ToolRegistry(), allowlistDomains: [],
    ...(pii ? { pii: new RegexPiiMasker() } : {}),
  };
  return { repo, deps };
}

describe('PRD M2 — per-agent tool allowlist', () => {
  it('rejects a tool outside the agent allowlist', async () => {
    const model = new ScriptedModelProvider([toolCallTurn('forbidden_tool', {}, 'c1')]);
    const { deps } = await setup(agent({ allowedTools: ['allowed_tool'] }), {}, model);
    await expect(executeRun('run_1', deps)).rejects.toBeInstanceOf(ToolNotAllowedError);
  });
});

describe('PRD §4 — PII masking in the runtime', () => {
  it('masks PII before the model sees it and un-masks the output', async () => {
    const captured: { system: string; messages: { content: string }[] }[] = [];
    const model: ModelProvider = {
      async complete(args: { system: string; messages: { content: string }[] }): Promise<ModelTurn> {
        captured.push({ system: args.system, messages: args.messages });
        return { text: 'Sent to [EMAIL_1].', toolCalls: [], tokensIn: 5, tokensOut: 5, model: 'claude-sonnet-4-6' };
      },
    };
    const { repo, deps } = await setup(
      agent(),
      { input: { prompt: 'write to john@acme.com please' } },
      model,
      true, // enable PII masking
    );
    await executeRun('run_1', deps);

    // The model never saw the raw email.
    expect(captured[0].messages[0].content).toContain('[EMAIL_1]');
    expect(captured[0].messages[0].content).not.toContain('john@acme.com');
    // The stored output was un-masked back to the real value.
    expect((await repo.getRun('run_1'))?.output).toBe('Sent to john@acme.com.');
  });
});
