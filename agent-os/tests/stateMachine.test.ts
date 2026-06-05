import {
  canTransition,
  isTerminal,
  transition,
  IllegalTransitionError,
  ALLOWED_TRANSITIONS,
} from '../src/domain/runStateMachine';
import { RunStatus } from '../src/domain/types';

describe('Run state machine', () => {
  it('permits the documented legal transitions', () => {
    expect(transition('queued', 'running')).toBe('running');
    expect(transition('queued', 'canceled')).toBe('canceled');
    expect(transition('running', 'paused')).toBe('paused');
    expect(transition('running', 'succeeded')).toBe('succeeded');
    expect(transition('running', 'failed')).toBe('failed');
    expect(transition('paused', 'running')).toBe('running');
  });

  it('rejects illegal "jumps" between states', () => {
    expect(() => transition('queued', 'succeeded')).toThrow(IllegalTransitionError);
    expect(() => transition('succeeded', 'running')).toThrow(IllegalTransitionError);
    expect(() => transition('failed', 'running')).toThrow(IllegalTransitionError);
    expect(() => transition('canceled', 'running')).toThrow(IllegalTransitionError);
    expect(() => transition('running', 'queued')).toThrow(IllegalTransitionError);
  });

  it('treats succeeded/failed/canceled as terminal (no outgoing edges)', () => {
    for (const terminal of ['succeeded', 'failed', 'canceled'] as RunStatus[]) {
      expect(isTerminal(terminal)).toBe(true);
      expect(ALLOWED_TRANSITIONS[terminal]).toHaveLength(0);
    }
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('running')).toBe(false);
  });

  it('canTransition agrees with the transition guard', () => {
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('queued', 'paused')).toBe(false);
  });
});
