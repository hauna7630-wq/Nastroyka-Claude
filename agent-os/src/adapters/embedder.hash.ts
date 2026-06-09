// Deterministic, offline embedder via feature hashing (bag-of-words -> fixed-dim
// signed vector, L2-normalised). Makes vector memory runnable + testable with zero
// external calls; production swaps in OpenAIEmbedder behind the same port (the
// pgvector column dimension must match the embedder's `dim`).

import { Embedder } from '../ports/embedder';
import { l2normalize } from './vector';

export const HASH_EMBED_DIM = 256;

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
}

export class HashEmbedder implements Embedder {
  readonly dim = HASH_EMBED_DIM;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedOne(t));
  }

  private embedOne(text: string): number[] {
    const v = new Array(this.dim).fill(0);
    for (const tok of tokenize(text)) {
      const bucket = fnv1a(tok) % this.dim;
      const sign = fnv1a(tok + ' sign') & 1 ? 1 : -1;
      v[bucket] += sign;
    }
    return l2normalize(v);
  }
}
