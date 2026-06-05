// Full-text search over page content using Postgres tsvector. MVP precursor to
// the AI/RAG search in T2 (which swaps to pgvector + embeddings).

import { prisma } from '../db';

export interface SearchHit {
  id: string;
  title: string;
  slug: string;
  spaceId: string;
  rank: number;
  snippet: string;
}

export async function searchPages(spaceId: string, query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  // Parameterised via tagged template; identifiers are static.
  const rows = await prisma.$queryRaw<SearchHit[]>`
    SELECT
      id,
      title,
      slug,
      "spaceId",
      ts_rank(
        to_tsvector('simple', title || ' ' || "contentText"),
        websearch_to_tsquery('simple', ${q})
      )::float8 AS rank,
      ts_headline(
        'simple',
        "contentText",
        websearch_to_tsquery('simple', ${q}),
        'MaxFragments=1,MaxWords=20,MinWords=5,StartSel=<mark>,StopSel=</mark>'
      ) AS snippet
    FROM "Page"
    WHERE "spaceId" = ${spaceId}
      AND archived = false
      AND to_tsvector('simple', title || ' ' || "contentText")
          @@ websearch_to_tsquery('simple', ${q})
    ORDER BY rank DESC
    LIMIT 20
  `;
  return rows;
}
