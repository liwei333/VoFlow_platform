-- CreateEnum
CREATE TYPE "ReferenceSourceType" AS ENUM ('url', 'asset', 'pasted_text');

-- CreateEnum
CREATE TYPE "ReferenceSourceStatus" AS ENUM ('pending', 'parsing', 'transcribing', 'analyzing', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "reference_sources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sourceType" "ReferenceSourceType" NOT NULL,
    "platform" TEXT,
    "sourceUrl" TEXT,
    "assetId" TEXT,
    "status" "ReferenceSourceStatus" NOT NULL DEFAULT 'pending',
    "durationMs" INTEGER,
    "transcriptScriptId" TEXT,
    "structureJson" JSONB,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_sources_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reference_sources_duration_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0)
);

-- CreateIndex
CREATE INDEX "reference_sources_projectId_createdAt_idx" ON "reference_sources"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "reference_sources_teamId_createdAt_idx" ON "reference_sources"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "reference_sources_assetId_idx" ON "reference_sources"("assetId");

-- CreateIndex
CREATE INDEX "reference_sources_transcriptScriptId_idx" ON "reference_sources"("transcriptScriptId");

-- CreateIndex
CREATE INDEX "reference_sources_status_idx" ON "reference_sources"("status");

-- AddForeignKey
ALTER TABLE "reference_sources" ADD CONSTRAINT "reference_sources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_sources" ADD CONSTRAINT "reference_sources_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_sources" ADD CONSTRAINT "reference_sources_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_sources" ADD CONSTRAINT "reference_sources_transcriptScriptId_fkey" FOREIGN KEY ("transcriptScriptId") REFERENCES "scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
