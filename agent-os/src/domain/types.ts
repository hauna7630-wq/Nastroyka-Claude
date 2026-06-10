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
}

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  type: AgentType;
  systemPrompt: string;
  // Per-agent tool allowlist (PRD M2). Empty/undefined = all tools allowed.
  allowedTools?: string[];
}

export interface Run {
  id: string;
  orgId: string;
  agentId: string;
  status: RunStatus;
  input: unknown;
  output?: unknown;
  error?: string;
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

export interface DeadLetterRecord {
  runId: string;
  payload: unknown;
  failureReason: string;
  attempts: number;
}

// Agent memory (F5): short-term (run-scoped), long-term (durable notes /
// future vector knowledge), and episodic (summaries of prior runs).
export interface MemoryRecord {
  id?: string;
  agentId: string;
  kind: MemoryKind;
  content: unknown;
  runId?: string;
  createdAt?: number;
}

// Dialog memory: one persistent chat thread per (org, agent). The user message
// carries the runId of the run answering it; the agent reply row carries the
// same runId (uniqueness on (runId, role) makes reply backfill idempotent).
export type ChatRole = 'user' | 'agent';

export interface ChatMessageRecord {
  id?: string;
  orgId: string;
  agentId: string;
  role: ChatRole;
  text: string;
  runId?: string;
  createdAt?: number;
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
  // Model id that produced this turn (for USD cost accounting). Optional.
  model?: string;
}

// The payload placed on the queue to request execution of a run.
export interface RunJob {
  runId: string;
}
