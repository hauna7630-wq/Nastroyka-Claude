// Agent-to-agent hand-off: an agent that decides a task belongs to a colleague
// emits, on its own line, `ПОРУЧЕНИЕ <Имя>: <задача>`. After the agent's run
// succeeds the worker calls processHandoffs, which creates an assignment for the
// colleague AND auto-starts it (no manual «Приступить»), records the child run id
// on the parent so the chat client can stream the colleague's result back into the
// same thread, and cleans the directive out of the parent's reply. Chains are
// allowed up to a depth limit so a hand-off can't loop forever.

import { Repository } from '../ports/repository';
import { Queue } from '../ports/queue';
import { Agent, Run } from '../domain/types';
import { outputToReplyText } from './chatPrompt';

export interface HandoffDeps {
  repo: Repository;
  queue: Queue;
}

// How many times a task may be re-delegated. Top-level chat run = depth 0; each
// hand-off adds 1. Configurable so it can be tuned without a redeploy.
export function delegMaxDepth(): number {
  const n = Number(process.env.AGENT_DELEG_MAX_DEPTH);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}

function shortNameOf(name: string): string {
  return name.split(' — ')[0];
}

// Parse ONLY the exact capitalised directive on its own line (not the
// conversational `поручи Имя:`), so prose mentioning delegation never fires.
export function parseHandoffDirectives(
  text: string,
  agents: Agent[],
): Array<{ agent: Agent; task: string; line: string }> {
  const out: Array<{ agent: Agent; task: string; line: string }> = [];
  const re = /^[\s>*-]*ПОРУЧЕНИЕ\s+([A-Za-zА-Яа-яЁё]+)\s*:\s*(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || '')) !== null) {
    const lc = m[1].toLowerCase();
    const agent = agents.find((a) => shortNameOf(a.name).toLowerCase() === lc);
    const task = (m[2] || '').trim();
    if (agent && task) out.push({ agent, task, line: m[0] });
  }
  return out;
}

// Build the dormant-but-immediately-started assignment run for a colleague.
function assignmentInput(args: {
  task: string;
  from: string;
  originAgentId: string;
  depth: number;
}): Record<string, unknown> {
  const prompt =
    'Тебе поручение от ' + args.from + ' (коллега по команде). Выполни его полностью и дай ' +
    'готовый результат.\n\nЗадача:\n' + args.task;
  return {
    prompt,
    assignment: true,
    from: args.from,
    task: args.task,
    chat: true,
    originAgentId: args.originAgentId,
    delegDepth: args.depth,
    started: true, // auto-run: enqueued right away, no «Приступить»
  };
}

// Called by the worker after a run succeeds. Best-effort: any failure here must
// never fail the underlying run (the colleague's work is a follow-up, not a
// precondition). Idempotent via deterministic child ids + idempotent createRun.
export async function processHandoffs(deps: HandoffDeps, runId: string): Promise<void> {
  const { repo, queue } = deps;
  const run = await repo.getRun(runId);
  if (!run) return;
  const input = (run.input as Record<string, unknown> | null) || {};
  if (input.chat !== true) return; // only chat / assignment runs delegate

  const text = run.output !== undefined ? outputToReplyText(run.output) : '';
  if (!text) return;
  const roster = await repo.listAgents(run.orgId);
  const directives = parseHandoffDirectives(text, roster).filter((d) => d.agent.id !== run.agentId);
  if (!directives.length) return;

  const depth = typeof input.delegDepth === 'number' ? input.delegDepth : 0;
  const fromAgent = await repo.getAgent(run.agentId);
  const fromName = fromAgent ? shortNameOf(fromAgent.name) : 'Коллега';

  let cleaned = text;
  const handoffs: Array<{ runId: string; to: string; task: string }> = [];

  for (const d of directives) {
    const to = shortNameOf(d.agent.name);
    if (depth + 1 > delegMaxDepth()) {
      cleaned = cleaned.replace(d.line, '(дальше передавать нельзя — достигнут лимит цепочки поручений)');
      continue;
    }
    const childId = runId + '::deleg::' + d.agent.id;
    try {
      const child: Run = {
        id: childId,
        orgId: run.orgId,
        agentId: d.agent.id,
        status: 'queued',
        input: assignmentInput({ task: d.task, from: fromName, originAgentId: run.agentId, depth: depth + 1 }),
        attempts: 0,
      };
      await repo.createRun(child); // idempotent by id
      await queue.enqueue({ runId: childId });
      await repo.audit({
        orgId: run.orgId,
        runId: childId,
        actor: 'handoff',
        action: 'assignment.auto_started',
        meta: { from: fromName, to: d.agent.name, depth: depth + 1 },
      });
      handoffs.push({ runId: childId, to, task: d.task });
      cleaned = cleaned.replace(d.line, '📥 Передал(а): ' + to + ' — «' + d.task + '» (выполняет…)');
    } catch {
      // best-effort: drop the directive line so the user never sees raw markup
      cleaned = cleaned.replace(d.line, '');
    }
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  // Single patch: clean the parent reply + record child ids so the client can
  // stream the colleague's result into the same thread. Same-status patch.
  await repo.updateRunStatus(runId, run.status, {
    output: cleaned,
    input: handoffs.length ? { ...input, handoffs } : input,
  });
}
