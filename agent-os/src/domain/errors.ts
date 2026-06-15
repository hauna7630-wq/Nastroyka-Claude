// Honest error taxonomy: map raw run errors to actionable, human-readable
// Russian messages, and detect placeholder model output. The platform must
// never show "(ответ слишком долго)" or a bare "…" — the user always sees the
// real reason and what to do next.

import { RunStatus } from './types';

// True for output that is only whitespace / dots / ellipses — the model
// produced no real answer and the run must not be considered a success.
export function isPlaceholderText(text: string): boolean {
  return /^[\s.…·]*$/u.test(text);
}

export const EMPTY_OUTPUT_ERROR =
  'модель вернула пустой ответ (без текста и без инструментов)';

// Map a raw run.error string to a human explanation (RU). Substring checks are
// ordered from most to least specific; the default surfaces the raw message
// instead of hiding it.
export function humanizeRunError(error?: string | null, status?: RunStatus): string | undefined {
  if (!error) {
    if (status === 'paused') return 'Агент ждёт вашего решения (достигнут лимит шагов).';
    return undefined;
  }
  const e = error;
  const lower = e.toLowerCase();

  if (lower.includes('claude cli timed out')) {
    return 'Модель не ответила вовремя (таймаут ожидания LLM). Нажмите «Повторить».';
  }
  const exited = /claude CLI exited (\d+)\s*:?\s*([\s\S]*)/i.exec(e);
  if (exited) {
    const detail = (exited[2] || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    return (
      'Сбой провайдера модели (CLI код ' + exited[1] + ')' +
      (detail ? ': ' + detail : '') + '. Нажмите «Повторить».'
    );
  }
  if (lower.includes('enoent') || lower.includes('spawn claude')) {
    return 'Провайдер модели недоступен на сервере (Claude CLI не найден).';
  }
  if (lower.includes('exceeded max iterations')) {
    return 'Агент не уложился в лимит шагов — нужно ваше решение.';
  }
  if (lower.includes(EMPTY_OUTPUT_ERROR)) {
    return 'Модель вернула пустой ответ несколько раз подряд. Нажмите «Повторить».';
  }
  if (lower.includes('not allowed for agent')) {
    return 'Агенту запрещён инструмент, который ему понадобился, — обновите его allowlist.';
  }
  if (lower.includes('no agent of type')) {
    return 'В команде нет агента нужного типа — наймите его во вкладке «Команда».';
  }
  if (lower.includes('econnrefused') || lower.includes('redis')) {
    return 'Очередь задач недоступна — повторите позже.';
  }
  if (lower.includes('did not succeed')) {
    return 'Подзадача команды не выполнилась — откройте журнал задачи.';
  }
  return 'Внутренняя ошибка: ' + e.slice(0, 140);
}

// Live status line for a pending chat bubble (never a bare "…").
export function describeRunStatus(status: RunStatus, elapsedMs?: number): string {
  if (status === 'queued') return 'в очереди…';
  if (status === 'running') {
    const min = elapsedMs ? Math.floor(elapsedMs / 60000) : 0;
    return min >= 1 ? 'думает… (' + min + ' мин)' : 'думает…';
  }
  if (status === 'paused') return 'нужно ваше решение';
  return status;
}
