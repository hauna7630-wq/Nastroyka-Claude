import {
  rescuePartialFromJson,
  TURN_LIMIT_MARKER,
} from '../src/adapters/model.claudeSubscription';

describe('rescuePartialFromJson', () => {
  it('salvages partial work from an error_max_turns result + adds the nudge', () => {
    const out = JSON.stringify({
      type: 'result',
      subtype: 'error_max_turns',
      is_error: true,
      num_turns: 9,
      result: 'Вот черновик презентации для инвестора…',
    });
    const rescued = rescuePartialFromJson(out);
    expect(rescued).toBe('Вот черновик презентации для инвестора…' + TURN_LIMIT_MARKER);
    expect(rescued).toMatch(/продолжай/);
  });

  it('returns null for a turn-limit stop with no text', () => {
    const out = JSON.stringify({ subtype: 'error_max_turns', result: '' });
    expect(rescuePartialFromJson(out)).toBeNull();
  });

  it('returns null for other failures (not a turn-limit stop)', () => {
    expect(rescuePartialFromJson(JSON.stringify({ subtype: 'error_other', result: 'x' }))).toBeNull();
    expect(rescuePartialFromJson('not json at all')).toBeNull();
    expect(rescuePartialFromJson('')).toBeNull();
  });
});
