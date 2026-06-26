-- CreateEnum
CREATE TYPE "ExportOutputProfile" AS ENUM ('mp4_720p', 'mp4_1080p');

-- CreateEnum
CREATE TYPE "ExportRequestStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "export_requests" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "avatarVideoArtifactId" TEXT NOT NULL,
    "audioArtifactId" TEXT NOT NULL,
    "editingConfigId" TEXT NOT NULL,
    "subtitleArtifactId" TEXT,
    "bgmAssetId" TEXT,
    "coverArtifactId" TEXT,
    "outputProfile" "ExportOutputProfile" NOT NULL DEFAULT 'mp4_720p',
    "status" "ExportRequestStatus" NOT NULL DEFAULT 'queued',
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "export_requests_jobId_createdAt_idx" ON "export_requests"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "export_requests_nodeId_idx" ON "export_requests"("nodeId");

-- CreateIndex
CREATE INDEX "export_requests_avatarVideoArtifactId_idx" ON "export_requests"("avatarVideoArtifactId");

-- CreateIndex
CREATE INDEX "export_requests_audioArtifactId_idx" ON "export_requests"("audioArtifactId");

-- CreateIndex
CREATE INDEX "export_requests_editingConfigId_idx" ON "export_requests"("editingConfigId");

-- CreateIndex
CREATE INDEX "export_requests_subtitleArtifactId_idx" ON "export_requests"("subtitleArtifactId");

-- CreateIndex
CREATE INDEX "export_requests_bgmAssetId_idx" ON "export_requests"("bgmAssetId");

-- CreateIndex
CREATE INDEX "export_requests_coverArtifactId_idx" ON "export_requests"("coverArtifactId");

-- CreateIndex
CREATE INDEX "export_requests_outputProfile_idx" ON "export_requests"("outputProfile");

-- CreateIndex
CREATE INDEX "export_requests_status_idx" ON "export_requests"("status");

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_avatarVideoArtifactId_fkey" FOREIGN KEY ("avatarVideoArtifactId") REFERENCES "artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_audioArtifactId_fkey" FOREIGN KEY ("audioArtifactId") REFERENCES "artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_editingConfigId_fkey" FOREIGN KEY ("editingConfigId") REFERENCES "editing_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_subtitleArtifactId_fkey" FOREIGN KEY ("subtitleArtifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_bgmAssetId_fkey" FOREIGN KEY ("bgmAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_requests" ADD CONSTRAINT "export_requests_coverArtifactId_fkey" FOREIGN KEY ("coverArtifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
