// Split page text into overlapping chunks for embedding. Pure + testable.

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 500;
  const overlap = opts.overlap ?? 80;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    // Prefer breaking on a word boundary when we're not at the very end.
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(' ', end);
      if (lastSpace > start + maxChars * 0.6) end = lastSpace;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap); // advance, keeping overlap
  }
  return chunks;
}
