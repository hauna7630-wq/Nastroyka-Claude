import { assembleChatPrompt, outputToReplyText } from '../src/agent/chatPrompt';
import { ChatMessageRecord } from '../src/domain/types';

function msg(role: 'user' | 'agent', text: string, t: number): ChatMessageRecord {
  return { orgId: 'o', agentId: 'a', role, text, createdAt: t };
}

describe('assembleChatPrompt', () => {
  it('passes the new message through unchanged when there is no history', () => {
    expect(assembleChatPrompt([], 'привет')).toBe('привет');
  });

  it('renders dialog context oldest→newest with speakers and the new message', () => {
    const history = [
      msg('user', 'как дела с отчётом?', 1),
      msg('agent', 'отчёт готов на 80%', 2),
    ];
    const p = assembleChatPrompt(history, 'когда финал?');
    expect(p).toContain('Пользователь: как дела с отчётом?');
    expect(p).toContain('Ты: отчёт готов на 80%');
    expect(p).toContain('Новое сообщение пользователя:\nкогда финал?');
    expect(p.indexOf('как дела')).toBeLessThan(p.indexOf('отчёт готов'));
  });

  it('keeps only the newest messages within the message window', () => {
    const history: ChatMessageRecord[] = [];
    for (let i = 0; i < 30; i++) history.push(msg('user', 'm' + i, i));
    const p = assembleChatPrompt(history, 'new', { maxMessages: 5 });
    expect(p).toContain('m29');
    expect(p).not.toContain('m10');
  });

  it('respects the total char budget, dropping oldest first', () => {
    const big = 'x'.repeat(500);
    const history = [msg('user', big, 1), msg('agent', big, 2), msg('user', big, 3)];
    const p = assembleChatPrompt(history, 'q', { maxTotalChars: 1100, maxCharsPerMessage: 1000 });
    // ~2 messages fit (≈500 each); the oldest is dropped.
    expect((p.match(/x{400}/g) || []).length).toBeLessThanOrEqual(2);
  });
});

describe('outputToReplyText', () => {
  it('handles strings, orchestrator reports, and objects', () => {
    expect(outputToReplyText('hi')).toBe('hi');
    expect(outputToReplyText({ report: '## Отчёт', summary: 'x' })).toBe('## Отчёт');
    expect(outputToReplyText({ summary: 'итог' })).toBe('итог');
    expect(outputToReplyText({ text: 't' })).toBe('t');
    expect(outputToReplyText({ k: 1 })).toBe('{"k":1}');
  });
});
