// HTTP + SSE server adapter (F4) over the ControlPlane. Built on Node's `http`
// module (zero deps). Routes are intentionally minimal; this is the thin edge
// over the framework-agnostic ControlPlane, which holds the logic and the tests.

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { ControlPlane, NotFoundError, ValidationError } from './controlPlane';
import { RunEvent } from '../events/bus';
import { COORDINATOR_HTML } from './ui';

// 30MB request cap: enough for a ~20MB file as base64; protects the process.
const MAX_BODY = 30 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new ValidationError('файл слишком большой (лимит ~20МБ) — разбейте его на части'));
        return;
      }
      chunks.push(Buffer.from(c));
    });
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
      // GET /  — Coordinator UI
      if (method === 'GET' && path === '/') {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store, must-revalidate',
        });
        res.end(COORDINATOR_HTML);
        return;
      }
      // POST /tasks  — Coordinator entry point (natural-language task)
      if (method === 'POST' && path === '/tasks') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(res, 201, await cp.submitTask(body));
      }
      // POST /runs
      if (method === 'POST' && path === '/runs') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(res, 201, await cp.createRun(body));
      }
      // GET /runs/:id  and  GET /runs/:id/(metrics|events|team)
      if (method === 'GET' && seg[0] === 'runs' && seg[1]) {
        const runId = seg[1];
        if (seg[2] === 'events') return streamEvents(cp, runId, res);
        if (seg[2] === 'metrics') return json(res, 200, await cp.runMetrics(runId));
        if (seg[2] === 'team') return json(res, 200, await cp.getRunTeam(runId));
        return json(res, 200, await cp.getRun(runId));
      }
      // POST /runs/:id/retry — re-enqueue a failed run (chat «Повторить»)
      if (method === 'POST' && seg[0] === 'runs' && seg[1] && seg[2] === 'retry') {
        return json(res, 200, await cp.retryRun(seg[1]));
      }
      // Per-agent run journal (observability). Registered BEFORE the
      // agents-list route, which matches on seg[2] without a length check.
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'agents' && seg[3] && seg[4] === 'runs') {
        return json(res, 200, await cp.listAgentRuns(seg[1], seg[3]));
      }
      // Toggle an emoji reaction on a message. Same ordering note as above.
      if (method === 'POST' && seg[0] === 'orgs' && seg[2] === 'agents' && seg[3] && seg[4] === 'messages' && seg[5] && seg[6] === 'react') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(
          res,
          200,
          await cp.reactToMessage({ orgId: seg[1], agentId: seg[3], messageId: seg[5], emoji: body.emoji }),
        );
      }
      // Personal chat thread (dialog memory). Same ordering note as above.
      if (seg[0] === 'orgs' && seg[2] === 'agents' && seg[3] && seg[4] === 'chat') {
        if (method === 'GET') {
          return json(res, 200, await cp.getChatHistory({ orgId: seg[1], agentId: seg[3] }));
        }
        if (method === 'POST') {
          const body = JSON.parse((await readBody(req)) || '{}');
          return json(
            res,
            201,
            await cp.sendChatMessage({
              orgId: seg[1],
              agentId: seg[3],
              text: body.text,
              attachment: body.attachment,
              attachments: body.attachments,
              replyTo: body.replyTo,
              autoRun: body.autoRun,
            }),
          );
        }
        if (method === 'DELETE') {
          return json(res, 200, await cp.clearChatHistory({ orgId: seg[1], agentId: seg[3] }));
        }
      }
      // Delegation: GET an agent's «Поручения» inbox, POST start one.
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'agents' && seg[3] && seg[4] === 'assignments') {
        return json(res, 200, await cp.listAssignments(seg[1], seg[3]));
      }
      if (method === 'POST' && seg[0] === 'orgs' && seg[2] === 'assignments' && seg[3] && seg[4] === 'start') {
        return json(res, 200, await cp.startAssignment({ orgId: seg[1], runId: seg[3] }));
      }
      // POST /agents  (Agent Factory)
      if (method === 'POST' && path === '/agents') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(res, 201, await cp.createAgent(body));
      }
      // GET /orgs/:id/agents  and  GET /orgs/:id/token-burn
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'agents') {
        return json(res, 200, await cp.listAgents(seg[1]));
      }
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'token-burn') {
        return json(res, 200, await cp.tokenBurn(seg[1]));
      }
      // GET /orgs/:id/tasks — top-level runs for the «Задачи» view
      if (method === 'GET' && seg[0] === 'orgs' && seg[2] === 'tasks') {
        return json(res, 200, await cp.listOrgTasks(seg[1]));
      }
      // Team catalog: list templates + hire a team into the org
      if (method === 'GET' && path === '/teams/templates') {
        return json(res, 200, cp.listTeamTemplates());
      }
      if (method === 'POST' && seg[0] === 'orgs' && seg[2] === 'teams' && seg[3] && seg[4] === 'hire') {
        return json(res, 201, await cp.hireTeam({ orgId: seg[1], templateId: seg[3] }));
      }
      // POST /documents/extract  — Doc-1: extract text from an uploaded file
      if (method === 'POST' && path === '/documents/extract') {
        const body = JSON.parse((await readBody(req)) || '{}');
        return json(res, 200, await cp.extractDocument(body));
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
