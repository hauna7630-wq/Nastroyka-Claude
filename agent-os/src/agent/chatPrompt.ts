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

export function assembleChatPrompt(
  history: ChatMessageRecord[],
  newText: string,
  opts: ChatPromptOptions = {},
): string {
  const cfg = { ...DEFAULTS, ...opts };
  if (history.length === 0) return newText;

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
  if (lines.length === 0) return newText;

  return [
    'Это продолжение диалога с пользователем. Последние сообщения переписки (старые выше, новые ниже):',
    '',
    lines.join('\n'),
    '',
    'Новое сообщение пользователя:',
    newText,
    '',
    'Ответь только на новое сообщение, учитывая контекст переписки. Не пересказывай историю.',
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
