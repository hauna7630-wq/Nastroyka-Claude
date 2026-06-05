// Embedding/indexing service (T2). Chunks a page's text, embeds the chunks, and
// (re)writes its PageChunk rows. PageChunk uses a pgvector column, so it is
// managed via raw SQL.
//
// Called inline from savePageContent for the MVP; production would enqueue this
// (e.g. via a job queue) so a slow/remote embedder doesn't block saves.

import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { chunkText } from '../ai/chunk';
import { toVectorLiteral } from '../ai/vector';
import { getEmbedder } from '../ai';

export async function indexPage(pageId: string): Promise<number> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, spaceId: true, title: true, contentText: true, archived: true },
  });
  if (!page) return 0;

  await prisma.$executeRaw`DELETE FROM "PageChunk" WHERE "pageId" = ${pageId}`;
  if (page.archived) return 0;

  // Include the title so it contributes to recall.
  const chunks = chunkText(`${page.title}. ${page.contentText}`.trim());
  if (chunks.length === 0) return 0;

  const vectors = await getEmbedder().embed(chunks);
  for (let i = 0; i < chunks.length; i++) {
    const literal = toVectorLiteral(vectors[i]);
    await prisma.$executeRaw`
      INSERT INTO "PageChunk" ("id", "pageId", "spaceId", "idx", "text", "embedding")
      VALUES (${randomUUID()}, ${pageId}, ${page.spaceId}, ${i}, ${chunks[i]}, ${literal}::vector)
    `;
  }
  return chunks.length;
}

export async function reindexSpace(spaceId: string): Promise<number> {
  const pages = await prisma.page.findMany({ where: { spaceId }, select: { id: true } });
  let total = 0;
  for (const p of pages) total += await indexPage(p.id);
  return total;
}
