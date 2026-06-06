// Control Plane (F4): the API surface that creates work, reports status, exposes
// observability and manages the DLQ. Framework-agnostic — these are plain async
// methods so they're trivially testable; the HTTP/SSE server (src/api/server.ts)
// is a thin adapter over them.

import { randomUUID } from 'crypto';
import { Repository } from '../ports/repository';
import { Queue } from '../ports/queue';
import { Observability } from '../observability/metrics';
import { EventBus } from '../events/bus';
import { AgentType, DeadLetterRecord, Run } from '../domain/types';

export interface ControlPlaneDeps {
  repo: Repository;
  queue: Queue;
  observability: Observability;
  events?: EventBus;
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`Not found: ${what}`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ControlPlane {
  constructor(private readonly deps: ControlPlaneDeps) {}

  // --- Agent Factory (PRD M2) ---

  async createAgent(args: {
    orgId: string;
    name: string;
    type: AgentType;
    systemPrompt: string;
    allowedTools?: string[];
  }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    if (!args.name?.trim()) throw new ValidationError('agent name is required');
    const agent = await this.deps.repo.createAgent(args);
    await this.deps.repo.audit({
      orgId: args.orgId,
      actor: 'control-plane',
      action: 'agent.created',
      meta: { agentId: agent.id, type: agent.type },
    });
    return agent;
  }

  async listAgents(orgId: string) {
    return this.deps.repo.listAgents(orgId);
  }

  // --- Runs ---

  async createRun(args: {
    orgId: string;
    agentId: string;
    input: unknown;
  }): Promise<{ runId: string; status: string }> {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    const agent = await this.deps.repo.getAgent(args.agentId);
    if (!agent || agent.orgId !== args.orgId) {
      throw new NotFoundError(`agent ${args.agentId}`);
    }

    const runId = randomUUID();
    const run: Run = {
      id: runId,
      orgId: args.orgId,
      agentId: args.agentId,
      status: 'queued',
      input: args.input,
      attempts: 0,
    };
    await this.deps.repo.createRun(run);
    await this.deps.repo.audit({
      orgId: args.orgId,
      runId,
      actor: 'control-plane',
      action: 'run.created',
    });
    await this.deps.queue.enqueue({ runId });

    return { runId, status: 'queued' };
  }

  async getRun(runId: string) {
    const run = await this.deps.repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    const trace = await this.deps.observability.runTrace(runId);
    return { run, trace };
  }

  // --- Observability ---

  async runMetrics(runId: string) {
    const metrics = await this.deps.observability.runMetrics(runId);
    if (!metrics) throw new NotFoundError(`run ${runId}`);
    return metrics;
  }

  async tokenBurn(orgId: string) {
    return this.deps.observability.tokenBurnByAgent(orgId);
  }

  // --- Dead letter queue ---

  async listDeadLetters(): Promise<DeadLetterRecord[]> {
    return this.deps.repo.listDeadLetters();
  }

  async requeueDeadLetter(runId: string): Promise<{ runId: string; status: string }> {
    const run = await this.deps.repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    if (run.status !== 'failed') {
      throw new ValidationError(`run ${runId} is not in a failed state (${run.status})`);
    }
    // Operator re-open: reset the attempt budget and re-queue. This deliberately
    // re-opens a terminal run, so it is audited explicitly.
    this.deps.queue.reset(runId);
    await this.deps.repo.updateRunStatus(runId, 'queued', { attempts: 0, error: undefined });
    await this.deps.repo.markDeadLetterRequeued(runId);
    await this.deps.repo.audit({
      orgId: run.orgId,
      runId,
      actor: 'control-plane',
      action: 'run.requeued',
    });
    await this.deps.queue.enqueue({ runId });
    return { runId, status: 'queued' };
  }

  // --- Live events (SSE/WS) ---

  subscribe(runId: string, listener: Parameters<EventBus['subscribe']>[1]): () => void {
    if (!this.deps.events) throw new Error('event bus not configured');
    return this.deps.events.subscribe(runId, listener);
  }
}
