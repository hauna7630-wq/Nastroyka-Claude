// Control Plane (F4): the API surface that creates work, reports status, exposes
// observability, manages the DLQ, and handles billing top-ups. Framework-agnostic
// — these are plain async methods so they're trivially testable; the HTTP/SSE
// server (src/api/server.ts) is a thin adapter over them.

import { randomUUID } from 'crypto';
import { Repository } from '../ports/repository';
import { Queue } from '../ports/queue';
import { Ledger } from '../billing/ledger';
import { Observability } from '../observability/metrics';
import { PaymentProvider } from '../billing/payments';
import { EventBus } from '../events/bus';
import { estimateRunCost } from '../billing/cost';
import { DeadLetterRecord, Run } from '../domain/types';

export interface ControlPlaneDeps {
  repo: Repository;
  queue: Queue;
  ledger: Ledger;
  observability: Observability;
  payments: PaymentProvider;
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

  // --- Runs ---

  async createRun(args: {
    orgId: string;
    agentId: string;
    input: unknown;
    estimate?: { estimatedToolCalls: number; estimatedTokens: number };
  }): Promise<{ runId: string; status: string; estimatedCost?: number }> {
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
      creditsUsed: 0,
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

    return {
      runId,
      status: 'queued',
      estimatedCost: args.estimate ? estimateRunCost(args.estimate) : undefined,
    };
  }

  async getRun(runId: string) {
    const run = await this.deps.repo.getRun(runId);
    if (!run) throw new NotFoundError(`run ${runId}`);
    const trace = await this.deps.observability.runTrace(runId);
    return { run, trace };
  }

  previewCost(args: { estimatedToolCalls: number; estimatedTokens: number }): {
    estimatedCost: number;
  } {
    return { estimatedCost: estimateRunCost(args) };
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

  // --- Billing top-up ---

  async createCheckout(args: { orgId: string; credits: number; amountCents: number }) {
    const org = await this.deps.repo.getOrg(args.orgId);
    if (!org) throw new NotFoundError(`org ${args.orgId}`);
    return this.deps.payments.createCheckout(args);
  }

  async handlePaymentWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ handled: boolean; applied?: boolean }> {
    const completed = this.deps.payments.parseWebhook(rawBody, signature);
    if (!completed) return { handled: false };
    const applied = await this.deps.ledger.grant({
      orgId: completed.orgId,
      source: 'stripe',
      externalId: completed.eventId,
      amount: completed.credits,
    });
    await this.deps.repo.audit({
      orgId: completed.orgId,
      actor: 'stripe',
      action: applied ? 'credits.granted' : 'credits.duplicate',
      meta: { eventId: completed.eventId, credits: completed.credits },
    });
    return { handled: true, applied };
  }

  // --- Live events (SSE/WS) ---

  subscribe(runId: string, listener: Parameters<EventBus['subscribe']>[1]): () => void {
    if (!this.deps.events) throw new Error('event bus not configured');
    return this.deps.events.subscribe(runId, listener);
  }
}
