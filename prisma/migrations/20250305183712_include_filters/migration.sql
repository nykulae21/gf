-- AlterTable
ALTER TABLE "FilterConfig" ADD COLUMN     "filterSettings" JSONB NOT NULL DEFAULT '{}';
