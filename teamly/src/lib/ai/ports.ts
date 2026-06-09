// AI ports for T2 (RAG search + assistant). The pipeline depends only on these;
// adapters are swapped at the factory (src/lib/ai/index.ts).

export interface Embedder {
  // Vector dimensionality (must match the pgvector column, vector(N)).
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface RetrievedChunk {
  pageId: string;
  pageTitle: string;
  text: string;
  score: number; // cosine similarity in [0,1]
}

export interface Citation {
  pageId: string;
  title: string;
}

export interface ChatAnswer {
  answer: string;
  refused: boolean;
  citations: Citation[];
}

export interface ChatModel {
  // Answer a question grounded ONLY in the provided context chunks.
  answer(question: string, context: RetrievedChunk[]): Promise<ChatAnswer>;
}
