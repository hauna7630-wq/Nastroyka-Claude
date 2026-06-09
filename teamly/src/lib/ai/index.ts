// AI factory: selects embedder + chat model from the environment. Defaults to the
// deterministic offline adapters (HashEmbedder + ExtractiveChatModel) so the RAG
// pipeline runs with zero external calls. Set the API keys to use real models.
//
// NOTE: the pgvector column is vector(256) to match HashEmbedder. Switching to a
// real embedder (e.g. OpenAI dim 1536) requires a migration to the new dimension.

import { Embedder, ChatModel } from './ports';
import { HashEmbedder, HASH_EMBED_DIM } from './hashEmbedder';
import { ExtractiveChatModel } from './extractiveChat';
import { OpenAIEmbedder } from './openaiEmbedder';
import { AnthropicChatModel } from './anthropicChat';

export const EMBED_DIM = HASH_EMBED_DIM;

let embedder: Embedder | undefined;
let chatModel: ChatModel | undefined;

export function getEmbedder(): Embedder {
  if (embedder) return embedder;
  if (process.env.OPENAI_API_KEY) {
    embedder = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY });
  } else {
    embedder = new HashEmbedder();
  }
  return embedder;
}

export function getChatModel(): ChatModel {
  if (chatModel) return chatModel;
  if (process.env.ANTHROPIC_API_KEY) {
    chatModel = new AnthropicChatModel({ apiKey: process.env.ANTHROPIC_API_KEY });
  } else {
    chatModel = new ExtractiveChatModel();
  }
  return chatModel;
}

// For tests that want to override the defaults.
export function __setAi(e?: Embedder, c?: ChatModel): void {
  embedder = e;
  chatModel = c;
}

export * from './ports';
