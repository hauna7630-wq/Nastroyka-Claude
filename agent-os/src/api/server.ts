// HTTP + SSE server adapter (F4) over the ControlPlane. Built on Node's `http`
// module (zero deps). Routes are intentionally minimal; this is the thin edge
// over the framework-agnostic ControlPlane, which holds the logic and the tests.

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { ControlPlane, NotFoundError, ValidationError } from './controlPlane';
import { RunEvent } from '../events/bus';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(payload);
}

function statusForError(err: unknown): number {
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ValidationError) return 400;
  return 500;
}

export function createControlPlaneServer(cp: ControlPlane): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const seg = path.split('/').filter(Boolean);

    try {
      // POST /runs
      if (method === 'POST' && path === '/runs') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(res, 201, await cp.createRun(body));
      }
      // GET /runs/:id  and  GET /runs/:id/(metrics|events)
      if (method === 'GET' && seg[0] === 'runs' && seg[1]) {
        const runId = seg[1];
        if (seg[2] === 'events') return streamEvents(cp, runId, res);
        if (seg[2] === 'metrics') return json(res, 200, await cp.runMetrics(runId));
        return json(res, 200, await cp.getRun(runId));
      }
      // GET /orgs/:id/token-burn
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'token-burn') {
        return json(res, 200, await cp.tokenBurn(seg[1]));
      }
      // GET /dlq  and  POST /dlq/:id/requeue
      if (method === 'GET' && path === '/dlq') {
        return json(res, 200, await cp.listDeadLetters());
      }
      if (method === 'POST' && seg[0] === 'dlq' && seg[2] === 'requeue') {
        return json(res, 200, await cp.requeueDeadLetter(seg[1]));
      }

      json(res, 404, { error: 'route not found' });
    } catch (err) {
      json(res, statusForError(err), {
        error: err instanceof Error ? err.message : 'internal error',
      });
    }
  });
}

// Server-Sent Events: stream a run's lifecycle events until the client closes.
function streamEvents(cp: ControlPlane, runId: string, res: ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const unsubscribe = cp.subscribe(runId, (event: RunEvent) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });
  res.on('close', () => unsubscribe());
}
