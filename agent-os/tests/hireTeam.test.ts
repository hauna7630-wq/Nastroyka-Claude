import { InMemoryRepository } from '../src/adapters/repo.inMemory';
import { InMemoryQueue } from '../src/adapters/queue.inMemory';
import { InMemoryEventBus } from '../src/events/bus';
import { ControlPlane } from '../src/api/controlPlane';
import { Observability } from '../src/observability/metrics';
import { TEAM_TEMPLATES } from '../src/teams/templates';

function build() {
  const repo = new InMemoryRepository();
  repo.seedOrg({ id: 'org_1', name: 'Acme' });
  const cp = new ControlPlane({
    repo,
    queue: new InMemoryQueue({ maxAttempts: 1 }),
    observability: new Observability(repo),
    events: new InMemoryEventBus(),
  });
  return { repo, cp };
}

describe('team catalog', () => {
  it('lists templates with members but without prompts', () => {
    const { cp } = build();
    const tpls = cp.listTeamTemplates();
    expect(tpls.length).toBeGreaterThanOrEqual(8);
    const marketing = tpls.find((t) => t.id === 'marketing');
    expect(marketing?.recommended).toBe(true);
    expect(marketing?.members.length).toBeGreaterThan(1);
    expect((marketing?.members[0] as Record<string, unknown>).systemPrompt).toBeUndefined();
  });

  it('hires the whole team and is idempotent by member name', async () => {
    const { cp, repo } = build();
    const first = await cp.hireTeam({ orgId: 'org_1', templateId: 'dev' });
    expect(first.hired.length).toBe(TEAM_TEMPLATES.find((t) => t.id === 'dev')!.members.length);
    const agents = await repo.listAgents('org_1');
    expect(agents.some((a) => a.name.startsWith('Stroyka'))).toBe(true);
    // Agents got real expert prompts.
    expect(agents[0].systemPrompt).toContain('топ-5%');

    const again = await cp.hireTeam({ orgId: 'org_1', templateId: 'dev' });
    expect(again.hired).toHaveLength(0);
    expect((await repo.listAgents('org_1')).length).toBe(agents.length);
  });

  it('404s on unknown template', async () => {
    const { cp } = build();
    await expect(cp.hireTeam({ orgId: 'org_1', templateId: 'nope' })).rejects.toThrow(/template/);
  });
});
