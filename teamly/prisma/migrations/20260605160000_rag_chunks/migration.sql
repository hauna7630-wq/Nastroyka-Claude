-- pgvector extension + embedded page chunks for RAG (T2).
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE "PageChunk" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(256) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PageChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PageChunk_spaceId_idx" ON "PageChunk"("spaceId");
CREATE INDEX "PageChunk_pageId_idx" ON "PageChunk"("pageId");
CREATE INDEX "PageChunk_embedding_idx" ON "PageChunk" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "PageChunk" ADD CONSTRAINT "PageChunk_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
