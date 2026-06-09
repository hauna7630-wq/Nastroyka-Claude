// pgvector long-term memory store (production). Embeds memory text and stores it
// in AgentMemory.embedding; recall uses cosine distance (`<=>`) scoped by agent.
// Managed via raw SQL because the `vector` column is not Prisma-typed.

import { randomUUID } from 'crypto';
import { MemoryRecord } from '../domain/types';
import { MemoryStore, RecallQuery, memoryText } from '../ports/memory';
import { Embedder } from '../ports/embedder';
import { toVectorLiteral } from './vector';

// Minimal tagged-template raw client (Prisma's $executeRaw / $queryRaw).
export interface RawSqlClient {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

interface Row {
  id: string;
  agentId: string;
  kind: MemoryRecord['kind'];
  content: unknown;
  runId: string | null;
  created: number;
}

export class PgVectorMemoryStore implements MemoryStore {
  constructor(
    private readonly db: RawSqlClient,
    private readonly embedder: Embedder,
  ) {}

  async remember(item: MemoryRecord): Promise<void> {
    const [vec] = await this.embedder.embed([memoryText(item)]);
    const lit = toVectorLiteral(vec);
    await this.db.$executeRaw`
      INSERT INTO "AgentMemory" ("id", "agentId", "kind", "content", "runId", "embedding")
      VALUES (${randomUUID()}, ${item.agentId}, ${item.kind}::"MemoryKind",
              ${JSON.stringify(item.content)}::jsonb, ${item.runId ?? null}, ${lit}::vector)
    `;
  }

  async recall(agentId: string, query: RecallQuery = {}): Promise<MemoryRecord[]> {
    const limit = query.limit ?? 5;
    const runId = query.runId ?? null;
    const fetch = Math.max(limit * 4, limit); // over-fetch, then filter by kind in JS

    let rows: Row[];
    if (query.query) {
      const [qv] = await this.embedder.embed([query.query]);
      const lit = toVectorLiteral(qv);
      rows = await this.db.$queryRaw<Row[]>`
        SELECT id, "agentId", kind, content, "runId",
               (extract(epoch from "createdAt") * 1000)::float8 AS created
        FROM "AgentMemory"
        WHERE "agentId" = ${agentId} AND embedding IS NOT NULL
          AND (kind::text <> 'short_term' OR "runId" = ${runId})
        ORDER BY embedding <=> ${lit}::vector
        LIMIT ${fetch}
      `;
    } else {
      rows = await this.db.$queryRaw<Row[]>`
        SELECT id, "agentId", kind, content, "runId",
               (extract(epoch from "createdAt") * 1000)::float8 AS created
        FROM "AgentMemory"
        WHERE "agentId" = ${agentId} AND embedding IS NOT NULL
          AND (kind::text <> 'short_term' OR "runId" = ${runId})
        ORDER BY "createdAt" DESC
        LIMIT ${fetch}
      `;
    }

    return rows
      .filter((r) => !query.kinds || query.kinds.includes(r.kind))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        agentId: r.agentId,
        kind: r.kind,
        content: r.content,
        runId: r.runId ?? undefined,
        createdAt: Number(r.created),
      }));
  }
}
