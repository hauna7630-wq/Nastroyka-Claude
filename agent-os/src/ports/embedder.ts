// Embedding port for vector long-term memory. Production: a hosted embedding
// model (OpenAI/Voyage). Offline/tests: a deterministic feature-hash embedder.

export interface Embedder {
  // Vector dimensionality (must match the pgvector column, vector(N)).
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}
