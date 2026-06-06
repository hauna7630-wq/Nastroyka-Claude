// Observability (F4): metrics derived from the Run/Step trace.
//
// MVP computes these by reading the repository; production would materialise them
// into a metrics store / dashboards (LangSmith-style run tracing + token-burn).

import { Repository } from '../ports/repository';

export interface RunMetrics {
  runId: string;
  status: string;
  steps: number;
  tokensIn: number;
  tokensOut: number;
  totalLatencyMs: number;
}

export interface RunTraceStep {
  index: number;
  role: string;
  toolName?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export class Observability {
  constructor(private readonly repo: Repository) {}

  /** Full step trace for a single run (LangSmith-style). */
  async runTrace(runId: string): Promise<RunTraceStep[]> {
    const steps = await this.repo.listSteps(runId);
    return steps.map((s) => ({
      index: s.index,
      role: s.role,
      toolName: s.toolName,
      latencyMs: s.latencyMs,
      tokensIn: s.tokensIn,
      tokensOut: s.tokensOut,
    }));
  }

  /** Aggregate metrics for a single run. */
  async runMetrics(runId: string): Promise<RunMetrics | null> {
    const run = await this.repo.getRun(runId);
    if (!run) return null;
    const steps = await this.repo.listSteps(runId);
    let tokensIn = 0;
    let tokensOut = 0;
    let totalLatencyMs = 0;
    for (const s of steps) {
      tokensIn += s.tokensIn ?? 0;
      tokensOut += s.tokensOut ?? 0;
      totalLatencyMs += s.latencyMs ?? 0;
    }
    return {
      runId,
      status: run.status,
      steps: steps.length,
      tokensIn,
      tokensOut,
      totalLatencyMs,
    };
  }

  /** Token burn grouped by agent across an org's runs. */
  async tokenBurnByAgent(orgId: string): Promise<Record<string, number>> {
    const runs = await this.repo.listRunsByOrg(orgId);
    const burn: Record<string, number> = {};
    for (const run of runs) {
      const steps = await this.repo.listSteps(run.id);
      const tokens = steps.reduce(
        (sum, s) => sum + (s.tokensIn ?? 0) + (s.tokensOut ?? 0),
        0,
      );
      burn[run.agentId] = (burn[run.agentId] ?? 0) + tokens;
    }
    return burn;
  }
}
