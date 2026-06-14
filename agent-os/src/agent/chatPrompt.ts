// Dialog-context assembly for the personal chat (Doc-A stage 3: dialog memory).
//
// Pure functions: given the persisted thread history and the new message,
// produce the single user-prompt string the run will execute with. Long-term /
// episodic memory recall stays on the SYSTEM side (runtime.ts) — the dialog
// context lives in the USER prompt; they compose rather than conflict.

import { ChatMessageRecord } from '../domain/types';

export interface ChatPromptOptions {
  // Max history messages included (newest win).
  maxMessages?: number;
  // Per-message char cap (older messages are clipped harder than dropped).
  maxCharsPerMessage?: number;
  // Total history char budget — oldest WHOLE messages are dropped first.
  maxTotalChars?: number;
}

const DEFAULTS: Required<ChatPromptOptions> = {
  maxMessages: 12,
  maxCharsPerMessage: 600,
  maxTotalChars: 4000,
};

// The chat framing is always applied — even with no history — so that
// task-oriented agents (e.g. the orchestrator) behave as a direct conversational
// partner in the personal chat and don't fall back to a "task received → Принято."
// coordinator reply. The directive insists on answering the message literally.
const CHAT_GUIDE = [
  'Ты сейчас в режиме ЖИВОГО личного чата с пользователем — отвечай как собеседник,',
  'напрямую и по существу на его сообщение. НЕ подтверждай получение, НЕ говори «Принято»,',
  'НЕ превращай сообщение в задачу для делегирования — сразу давай содержательный ответ.',
  'Если просят ответить кратко/одним словом/в заданном формате — выполни это буквально.',
  'ЧЕСТНОСТЬ (строго): не утверждай, что выполнил код, создал или изменил файлы, запустил',
  'тесты или «уже сделал» часть работы, если ты НЕ сделал это прямо в ЭТОМ ответе с реальным',
  'выводом. У тебя НЕТ общей файловой системы между сообщениями — не считай, что файлы из',
  'прошлых ответов существуют, и не выдумывай преемственность. Ты отвечаешь ОДИН раз на',
  'сообщение: не обещай фоновую работу, «статусы каждые N минут» или автономное выполнение во',
  'времени. Если чего-то не можешь (нет инструмента или среды) — скажи это прямо, без имитации.',
].join('\n');

export function assembleChatPrompt(
  history: ChatMessageRecord[],
  newText: string,
  opts: ChatPromptOptions = {},
): string {
  const cfg = { ...DEFAULTS, ...opts };

  // Newest messages win the budget; render oldest-first afterwards.
  const recent = history.slice(-cfg.maxMessages);
  const lines: string[] = [];
  let total = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const speaker = m.role === 'user' ? 'Пользователь' : 'Ты';
    let body = m.text.length > cfg.maxCharsPerMessage
      ? m.text.slice(0, cfg.maxCharsPerMessage) + '…'
      : m.text;
    const line = speaker + ': ' + body;
    if (total + line.length > cfg.maxTotalChars) break;
    total += line.length;
    lines.unshift(line);
  }

  if (lines.length === 0) {
    // No prior context — still frame it as a live chat so the answer is direct.
    return [CHAT_GUIDE, '', 'Сообщение пользователя:', newText].join('\n');
  }

  return [
    CHAT_GUIDE,
    '',
    'Контекст переписки (старые выше, новые ниже):',
    '',
    lines.join('\n'),
    '',
    'Новое сообщение пользователя:',
    newText,
    '',
    'Ответь только на новое сообщение, учитывая контекст. Не пересказывай историю.',
  ].join('\n');
}

// Server-side twin of the UI's replyText(): turn a run output (string or the
// orchestrator's aggregate object) into the readable reply persisted in the
// thread.
export function outputToReplyText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    if (typeof o.report === 'string' && o.report.trim()) return o.report;
    if (typeof o.text === 'string' && o.text.trim()) return o.text;
    if (typeof o.summary === 'string' && o.summary.trim()) return o.summary;
    if (o.summary !== undefined) return outputToReplyText(o.summary);
  }
  return JSON.stringify(output ?? '');
}
