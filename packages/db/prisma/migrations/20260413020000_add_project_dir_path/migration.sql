-- Add dirPath column to Project table for workspace scoping
ALTER TABLE "Project" ADD COLUMN "dirPath" TEXT;
