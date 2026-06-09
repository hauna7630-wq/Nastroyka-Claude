// Production answerer (Anthropic Claude). Builds a strictly-grounded RAG prompt
// that instructs the model to answer ONLY from the provided context and to say
// it doesn't know otherwise. Uses fetch — compile-only here (no key / network).
//
// Refusal is primarily enforced upstream by the retrieval threshold (rag.ts):
// the model is only called when relevant context exists.

import { ChatModel, ChatAnswer, RetrievedChunk } from './ports';

const SYSTEM = [
  'Ты — ассистент корпоративной базы знаний.',
  'Отвечай ТОЛЬКО на основе предоставленного контекста.',
  'Если ответа нет в контексте — честно скажи, что в базе знаний нет ответа.',
  'Ссылайся на источники по их заголовкам в квадратных скобках, например [Онбординг].',
].join(' ');

export class AnthropicChatModel implements ChatModel {
  constructor(
    private readonly opts: { apiKey: string; model?: string; maxTokens?: number },
  ) {}

  async answer(question: string, context: RetrievedChunk[]): Promise<ChatAnswer> {
    const citations = dedupe(context);
    const contextBlock = context
      .map((c) => `[${c.pageTitle}]\n${c.text}`)
      .join('\n\n---\n\n');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.opts.model ?? 'claude-sonnet-4-6',
        max_tokens: this.opts.maxTokens ?? 1024,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Контекст:\n\n${contextBlock}\n\nВопрос: ${question}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic messages failed: ${res.status}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    const answer = json.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return { answer, refused: false, citations };
  }
}

function dedupe(chunks: RetrievedChunk[]) {
  const seen = new Map<string, { pageId: string; title: string }>();
  for (const c of chunks) {
    if (!seen.has(c.pageId)) seen.set(c.pageId, { pageId: c.pageId, title: c.pageTitle });
  }
  return [...seen.values()];
}
