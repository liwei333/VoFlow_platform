-- CreateEnum
CREATE TYPE "AvatarRenderMode" AS ENUM ('preview', 'hd');

-- CreateEnum
CREATE TYPE "AvatarRenderCrop" AS ENUM ('head', 'half_body');

-- CreateTable
CREATE TABLE "avatar_render_requests" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "audioArtifactId" TEXT NOT NULL,
    "mode" "AvatarRenderMode" NOT NULL,
    "aspectRatio" "AspectRatio" NOT NULL,
    "crop" "AvatarRenderCrop" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avatar_render_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avatar_render_requests_jobId_createdAt_idx" ON "avatar_render_requests"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "avatar_render_requests_nodeId_idx" ON "avatar_render_requests"("nodeId");

-- CreateIndex
CREATE INDEX "avatar_render_requests_avatarId_idx" ON "avatar_render_requests"("avatarId");

-- CreateIndex
CREATE INDEX "avatar_render_requests_audioArtifactId_idx" ON "avatar_render_requests"("audioArtifactId");

-- AddForeignKey
ALTER TABLE "avatar_render_requests" ADD CONSTRAINT "avatar_render_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_render_requests" ADD CONSTRAINT "avatar_render_requests_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_render_requests" ADD CONSTRAINT "avatar_render_requests_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "avatars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_render_requests" ADD CONSTRAINT "avatar_render_requests_audioArtifactId_fkey" FOREIGN KEY ("audioArtifactId") REFERENCES "artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
