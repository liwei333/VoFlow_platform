-- CreateEnum
CREATE TYPE "VideoJobStatus" AS ENUM ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkflowNodeStatus" AS ENUM ('pending', 'queued', 'running', 'succeeded', 'failed', 'waiting_approval', 'approved', 'cancelled');

-- CreateTable
CREATE TABLE "video_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "VideoJobStatus" NOT NULL DEFAULT 'pending',
    "currentNode" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "video_jobs_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100)
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "WorkflowNodeStatus" NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 1,
    "input" JSONB,
    "output" JSONB,
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "workflow_nodes_version_check" CHECK ("version" >= 1),
    CONSTRAINT "workflow_nodes_retry_count_check" CHECK ("retryCount" >= 0)
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_jobs_projectId_idx" ON "video_jobs"("projectId");

-- CreateIndex
CREATE INDEX "video_jobs_teamId_createdAt_idx" ON "video_jobs"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "video_jobs_status_idx" ON "video_jobs"("status");

-- CreateIndex
CREATE INDEX "workflow_nodes_jobId_idx" ON "workflow_nodes"("jobId");

-- CreateIndex
CREATE INDEX "workflow_nodes_jobId_nodeType_idx" ON "workflow_nodes"("jobId", "nodeType");

-- CreateIndex
CREATE INDEX "workflow_nodes_status_idx" ON "workflow_nodes"("status");

-- CreateIndex
CREATE INDEX "artifacts_jobId_idx" ON "artifacts"("jobId");

-- CreateIndex
CREATE INDEX "artifacts_nodeId_idx" ON "artifacts"("nodeId");

-- AddForeignKey
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_jobs" ADD CONSTRAINT "video_jobs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
