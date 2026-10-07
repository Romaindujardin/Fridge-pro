-- AlterTable
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'repas';
