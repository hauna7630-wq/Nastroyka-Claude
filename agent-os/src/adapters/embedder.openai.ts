// Production embedder (OpenAI text-embedding-3-small, dim 1536). Compile-only
// here (no key / network); when used, the pgvector column must be vector(1536).

import { Embedder } from '../ports/embedder';

export class OpenAIEmbedder implements Embedder {
  readonly dim = 1536;

  constructor(private readonly opts: { apiKey: string; model?: string; baseUrl?: string }) {}

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.opts.baseUrl ?? 'https://api.openai.com/v1'}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.opts.apiKey}` },
      body: JSON.stringify({ model: this.opts.model ?? 'text-embedding-3-small', input: texts }),
    });
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}
