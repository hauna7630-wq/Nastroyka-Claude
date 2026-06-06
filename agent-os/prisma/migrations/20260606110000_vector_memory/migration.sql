-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "AgentMemory" ADD COLUMN     "embedding" vector(256);


CREATE INDEX "AgentMemory_embedding_idx" ON "AgentMemory" USING hnsw ("embedding" vector_cosine_ops);
