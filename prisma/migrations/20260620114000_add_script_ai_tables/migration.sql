-- CreateEnum
CREATE TYPE "ScriptSourceType" AS ENUM ('pasted', 'asr', 'generated');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('draft', 'ready', 'approved', 'archived');

-- CreateEnum
CREATE TYPE "ScriptCandidateStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "scripts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "sourceType" "ScriptSourceType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ScriptStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "scripts_version_check" CHECK ("version" >= 1)
);

-- CreateTable
CREATE TABLE "script_candidates" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "titleCandidates" JSONB,
    "riskReport" JSONB,
    "modelName" TEXT,
    "prompt" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ScriptCandidateStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_candidates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "script_candidates_version_check" CHECK ("version" >= 1)
);

-- CreateTable
CREATE TABLE "asr_segments" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asr_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asr_segments_time_range_check" CHECK ("startMs" >= 0 AND "endMs" >= "startMs")
);

-- CreateIndex
CREATE INDEX "scripts_projectId_idx" ON "scripts"("projectId");

-- CreateIndex
CREATE INDEX "scripts_jobId_idx" ON "scripts"("jobId");

-- CreateIndex
CREATE INDEX "scripts_status_idx" ON "scripts"("status");

-- CreateIndex
CREATE INDEX "script_candidates_scriptId_idx" ON "script_candidates"("scriptId");

-- CreateIndex
CREATE INDEX "script_candidates_status_idx" ON "script_candidates"("status");

-- CreateIndex
CREATE INDEX "asr_segments_scriptId_idx" ON "asr_segments"("scriptId");

-- CreateIndex
CREATE INDEX "asr_segments_scriptId_startMs_idx" ON "asr_segments"("scriptId", "startMs");

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scripts" ADD CONSTRAINT "scripts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_candidates" ADD CONSTRAINT "script_candidates_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asr_segments" ADD CONSTRAINT "asr_segments_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
