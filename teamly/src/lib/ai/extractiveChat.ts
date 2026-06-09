// Deterministic, offline answerer for tests/dev. It does NOT hallucinate: with
// no context it refuses; with context it returns the most relevant passage
// verbatim and cites the source pages. Production swaps in AnthropicChatModel.

import { ChatModel, ChatAnswer, RetrievedChunk, Citation } from './ports';

export const NO_ANSWER = 'В базе знаний нет ответа на этот вопрос.';

export class ExtractiveChatModel implements ChatModel {
  async answer(_question: string, context: RetrievedChunk[]): Promise<ChatAnswer> {
    if (context.length === 0) {
      return { answer: NO_ANSWER, refused: true, citations: [] };
    }
    const citations = dedupeCitations(context);
    // Extractive: surface the top passage(s) grounded in the KB.
    const answer = context
      .slice(0, 2)
      .map((c) => c.text)
      .join('\n\n');
    return { answer, refused: false, citations };
  }
}

function dedupeCitations(chunks: RetrievedChunk[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of chunks) {
    if (!seen.has(c.pageId)) seen.set(c.pageId, { pageId: c.pageId, title: c.pageTitle });
  }
  return [...seen.values()];
}
