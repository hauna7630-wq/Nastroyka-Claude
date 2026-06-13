import {
  humanizeRunError,
  isPlaceholderText,
  describeRunStatus,
  EMPTY_OUTPUT_ERROR,
} from '../src/domain/errors';

describe('isPlaceholderText', () => {
  it('detects empty / dots / ellipses as non-answers', () => {
    expect(isPlaceholderText('')).toBe(true);
    expect(isPlaceholderText('   ')).toBe(true);
    expect(isPlaceholderText('...')).toBe(true);
    expect(isPlaceholderText('…')).toBe(true);
    expect(isPlaceholderText(' . … · ')).toBe(true);
    expect(isPlaceholderText('Привет')).toBe(false);
    expect(isPlaceholderText('1')).toBe(false);
  });
});

describe('humanizeRunError', () => {
  it('maps known failures to actionable Russian reasons', () => {
    expect(humanizeRunError('claude CLI timed out')).toMatch(/таймаут/i);
    expect(humanizeRunError('claude CLI exited 137: killed')).toMatch(/кодом 137/);
    expect(humanizeRunError('spawn claude ENOENT')).toMatch(/CLI не найден/);
    expect(humanizeRunError('Run exceeded max iterations (5)')).toMatch(/лимит шагов/);
    expect(humanizeRunError(EMPTY_OUTPUT_ERROR)).toMatch(/пустой ответ/);
    expect(humanizeRunError('tool "x" not allowed for agent')).toMatch(/запрещён инструмент/);
    expect(humanizeRunError('No agent of type "coder"')).toMatch(/нет агента/);
    expect(humanizeRunError('connect ECONNREFUSED 127.0.0.1:6379')).toMatch(/Очередь/);
  });

  it('surfaces (not hides) unknown errors, and handles empty/paused', () => {
    expect(humanizeRunError('weird boom')).toMatch(/Внутренняя ошибка: weird boom/);
    expect(humanizeRunError(undefined)).toBeUndefined();
    expect(humanizeRunError(null, 'paused')).toMatch(/ждёт вашего решения/);
  });
});

describe('describeRunStatus', () => {
  it('never returns a bare placeholder', () => {
    expect(describeRunStatus('queued')).toBe('в очереди…');
    expect(describeRunStatus('running')).toBe('думает…');
    expect(describeRunStatus('running', 130000)).toMatch(/2 мин/);
    expect(describeRunStatus('paused')).toMatch(/решение/);
  });
});
