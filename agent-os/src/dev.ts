// Offline dev Coordinator: wires the whole stack in-memory (no Postgres/Redis/
// API key), seeds a demo team of typed agents, and serves the Coordinator UI.
//
//   npm run dev:coordinator   →   http://localhost:3000

import { InMemoryRepository } from './adapters/repo.inMemory';
import { InMemoryQueue } from './adapters/queue.inMemory';
import { InMemoryEventBus } from './events/bus';
import { Observability } from './observability/metrics';
import { ControlPlane } from './api/controlPlane';
import { createControlPlaneServer } from './index';
import { startWorker } from './worker/worker';
import { buildToolRegistry } from './index';
import { HeuristicPlanner } from './adapters/planner.heuristic';
import { DelayedEchoModel } from './adapters/model.echo';
import { InMemoryVectorMemoryStore } from './adapters/memory.vector.inMemory';
import { HashEmbedder } from './adapters/embedder.hash';
import { StaticSearchProvider } from './adapters/search.mock';
import { PlainTextDocumentParser } from './adapters/documents.text';
import { RegexPiiMasker } from './security/pii';

async function main(): Promise<void> {
  const repo = new InMemoryRepository();
  repo.seedOrg({ id: 'demo', name: 'Demo Co' });

  // The "team": an orchestrator (Coordinator) + typed digital employees.
  await repo.createAgent({ orgId: 'demo', name: 'Координатор', type: 'orchestrator', systemPrompt: 'Ты координатор. Декомпозируй задачу и распредели по агентам.' });
  await repo.createAgent({ orgId: 'demo', name: 'Ресёрчер', type: 'researcher', systemPrompt: 'Ты исследователь. Собери факты.' });
  await repo.createAgent({ orgId: 'demo', name: 'Аналитик', type: 'analyst', systemPrompt: 'Ты аналитик. Сделай выводы.' });
  await repo.createAgent({ orgId: 'demo', name: 'Райтер', type: 'writer', systemPrompt: 'Ты копирайтер. Напиши результат.' });

  const events = new InMemoryEventBus();
  const queue = new InMemoryQueue({ maxAttempts: 1, async: true });

  startWorker({
    queue,
    repo,
    model: new DelayedEchoModel(700),
    tools: buildToolRegistry(),
    allowlistDomains: [],
    events,
    pii: new RegexPiiMasker(),
    planner: new HeuristicPlanner(),
    complexityThreshold: 0, // always orchestrate (show the team graph)
    defaultAgentType: 'researcher',
    search: new StaticSearchProvider(),
    documents: new PlainTextDocumentParser(),
    memory: new InMemoryVectorMemoryStore(new HashEmbedder()),
  });

  const cp = new ControlPlane({ repo, queue, observability: new Observability(repo), events });
  const port = Number(process.env.PORT ?? 3000);
  createControlPlaneServer(cp).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`agent-os Coordinator (dev) → http://localhost:${port}`);
  });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
