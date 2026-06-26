-- CreateEnum
CREATE TYPE "PublishPlatform" AS ENUM ('douyin', 'kuaishou', 'xiaohongshu', 'wechat_channels', 'bilibili', 'youtube_shorts', 'tiktok');

-- CreateEnum
CREATE TYPE "ChannelAccountStatus" AS ENUM ('connected', 'expired', 'revoked', 'not_connected');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('pending', 'uploading', 'published', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "channel_accounts" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "PublishPlatform" NOT NULL,
    "accountName" TEXT,
    "encryptedToken" TEXT,
    "status" "ChannelAccountStatus" NOT NULL DEFAULT 'not_connected',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_drafts" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "platform" "PublishPlatform" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tagsJson" JSONB NOT NULL,
    "topicsJson" JSONB NOT NULL,
    "coverArtifactId" TEXT,
    "validationJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishes" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "publishDraftId" TEXT NOT NULL,
    "channelAccountId" TEXT NOT NULL,
    "platform" "PublishPlatform" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'pending',
    "requestId" TEXT,
    "remoteId" TEXT,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_accounts_teamId_userId_platform_key" ON "channel_accounts"("teamId", "userId", "platform");

-- CreateIndex
CREATE INDEX "channel_accounts_teamId_platform_idx" ON "channel_accounts"("teamId", "platform");

-- CreateIndex
CREATE INDEX "channel_accounts_userId_idx" ON "channel_accounts"("userId");

-- CreateIndex
CREATE INDEX "channel_accounts_status_idx" ON "channel_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "publish_drafts_jobId_platform_key" ON "publish_drafts"("jobId", "platform");

-- CreateIndex
CREATE INDEX "publish_drafts_platform_idx" ON "publish_drafts"("platform");

-- CreateIndex
CREATE INDEX "publish_drafts_coverArtifactId_idx" ON "publish_drafts"("coverArtifactId");

-- CreateIndex
CREATE INDEX "publishes_jobId_platform_idx" ON "publishes"("jobId", "platform");

-- CreateIndex
CREATE INDEX "publishes_publishDraftId_idx" ON "publishes"("publishDraftId");

-- CreateIndex
CREATE INDEX "publishes_channelAccountId_idx" ON "publishes"("channelAccountId");

-- CreateIndex
CREATE INDEX "publishes_status_idx" ON "publishes"("status");

-- AddForeignKey
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_drafts" ADD CONSTRAINT "publish_drafts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_drafts" ADD CONSTRAINT "publish_drafts_coverArtifactId_fkey" FOREIGN KEY ("coverArtifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishes" ADD CONSTRAINT "publishes_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishes" ADD CONSTRAINT "publishes_publishDraftId_fkey" FOREIGN KEY ("publishDraftId") REFERENCES "publish_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishes" ADD CONSTRAINT "publishes_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
