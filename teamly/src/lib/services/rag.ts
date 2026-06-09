// Retrieval-augmented generation over the knowledge base (T2).
//
// "No hallucinations": we only ask the chat model when retrieval is confident
// (best similarity ≥ threshold); otherwise we refuse. "No leaks": retrieval is
// scoped to a single space, so answers never cross tenant/space boundaries.

import { prisma } from '../db';
import { getEmbedder, getChatModel } from '../ai';
import { toVectorLiteral } from '../ai/vector';
import { RetrievedChunk, ChatAnswer } from '../ai/ports';

export const RELEVANCE_THRESHOLD = 0.12;
export const REFUSAL = 'В базе знаний нет ответа на этот вопрос.';

export async function semanticSearch(
  spaceId: string,
  query: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  const q = query.trim();
  if (!q) return [];
  const [qvec] = await getEmbedder().embed([q]);
  const literal = toVectorLiteral(qvec);

  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      c."pageId"  AS "pageId",
      p.title     AS "pageTitle",
      c.text      AS text,
      (1 - (c.embedding <=> ${literal}::vector))::float8 AS score
    FROM "PageChunk" c
    JOIN "Page" p ON p.id = c."pageId"
    WHERE c."spaceId" = ${spaceId} AND p.archived = false
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${k}
  `;
}

export async function ask(spaceId: string, question: string): Promise<ChatAnswer> {
  const q = question.trim();
  if (!q) return { answer: 'Задайте вопрос.', refused: true, citations: [] };

  const hits = await semanticSearch(spaceId, q, 5);
  const best = hits[0]?.score ?? 0;
  if (hits.length === 0 || best < RELEVANCE_THRESHOLD) {
    return { answer: REFUSAL, refused: true, citations: [] };
  }
  return getChatModel().answer(q, hits);
}
