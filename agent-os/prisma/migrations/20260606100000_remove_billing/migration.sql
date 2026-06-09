-- DropForeignKey
ALTER TABLE "CreditGrant" DROP CONSTRAINT "CreditGrant_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedger" DROP CONSTRAINT "CreditLedger_orgId_fkey";

-- DropForeignKey
ALTER TABLE "CreditLedger" DROP CONSTRAINT "CreditLedger_runId_fkey";

-- AlterTable
ALTER TABLE "Org" DROP COLUMN "creditBalance";

-- AlterTable
ALTER TABLE "Run" DROP COLUMN "budgetUsd",
DROP COLUMN "creditsUsed";

-- DropTable
DROP TABLE "CreditGrant";

-- DropTable
DROP TABLE "CreditLedger";

