-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "aiExplanation" TEXT,
ADD COLUMN     "aiQuestions" JSONB,
ADD COLUMN     "aiSummary" JSONB;
