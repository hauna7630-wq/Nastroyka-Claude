// Core domain types shared across planes. These mirror the Prisma schema but
// are framework-free so the runtime never depends on Prisma directly.

export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type AgentType =
  | 'researcher'
  | 'writer'
  | 'analyst'
  | 'coder'
  | 'orchestrator'
  | 'reviewer';

export type MemoryKind = 'short_term' | 'long_term' | 'episodic';

export type StepRole = 'system' | 'assistant' | 'tool' | 'user';

export interface Org {
  id: string;
  name: string;
  creditBalance: number;
}

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  type: AgentType;
  systemPrompt: string;
}

export interface Run {
  id: string;
  orgId: string;
  agentId: string;
  status: RunStatus;
  input: unknown;
  output?: unknown;
  error?: string;
  creditsUsed: number;
  attempts: number;
  // Set when this run is a subtask spawned by an orchestrator run (F6).
  parentRunId?: string;
}

export interface Step {
  runId: string;
  index: number;
  role: StepRole;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface LedgerEntry {
  orgId: string;
  runId: string;
  stepIndex: number;
  toolCallId: string;
  amount: number; // negative = debit
  reason?: string;
}

export interface DeadLetterRecord {
  runId: string;
  payload: unknown;
  failureReason: string;
  attempts: number;
}

// A single tool invocation requested by the model.
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// One turn of the model: zero or more tool calls, plus optional final text.
export interface ModelTurn {
  text?: string;
  toolCalls: ToolCall[];
  tokensIn: number;
  tokensOut: number;
}

// The payload placed on the queue to request execution of a run.
export interface RunJob {
  runId: string;
}
