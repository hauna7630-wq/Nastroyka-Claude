-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "budgetUsd" DOUBLE PRECISION;

