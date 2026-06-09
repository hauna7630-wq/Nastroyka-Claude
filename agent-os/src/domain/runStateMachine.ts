// Formal Run state machine.
//
// Per the architecture review: state changes must NOT "jump" arbitrarily — every
// transition goes through `transition()`, which is the only sanctioned way to
// derive the next status. Terminal states have no outgoing edges.

import { RunStatus } from './types';

export const ALLOWED_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  queued: ['running', 'canceled'],
  running: ['paused', 'succeeded', 'failed', 'canceled'],
  paused: ['running', 'canceled'],
  succeeded: [],
  failed: [],
  canceled: [],
};

export const TERMINAL_STATES: ReadonlySet<RunStatus> = new Set<RunStatus>([
  'succeeded',
  'failed',
  'canceled',
]);

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: RunStatus,
    public readonly to: RunStatus,
  ) {
    super(`Illegal run transition: ${from} -> ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL_STATES.has(status);
}

/**
 * Returns `to` if the transition is legal, otherwise throws.
 * This is the single chokepoint for run status changes.
 */
export function transition(from: RunStatus, to: RunStatus): RunStatus {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
  return to;
}
