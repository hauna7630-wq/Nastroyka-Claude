-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('user', 'agent');

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "text" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_runId_role_key" ON "ChatMessage"("runId", "role");
CREATE INDEX "ChatMessage_orgId_agentId_createdAt_idx" ON "ChatMessage"("orgId", "agentId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
