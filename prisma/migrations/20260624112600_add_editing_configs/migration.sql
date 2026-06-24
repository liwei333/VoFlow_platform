-- CreateEnum
CREATE TYPE "EditingPipPosition" AS ENUM ('top_left', 'top_right', 'bottom_left', 'bottom_right');

-- CreateTable
CREATE TABLE "editing_configs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "subtitleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "keywordHighlightEnabled" BOOLEAN NOT NULL DEFAULT false,
    "bgmDuckingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pipEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pipAssetId" TEXT,
    "pipPosition" "EditingPipPosition" NOT NULL DEFAULT 'top_right',
    "pipSize" INTEGER NOT NULL DEFAULT 25,
    "backgroundAssetId" TEXT,
    "voiceVolume" INTEGER NOT NULL DEFAULT 100,
    "bgmVolume" INTEGER NOT NULL DEFAULT 35,
    "transitionStrength" INTEGER NOT NULL DEFAULT 50,
    "configJson" JSONB,
    "previewArtifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editing_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "editing_configs_pip_size_check" CHECK ("pipSize" >= 10 AND "pipSize" <= 60),
    CONSTRAINT "editing_configs_voice_volume_check" CHECK ("voiceVolume" >= 0 AND "voiceVolume" <= 100),
    CONSTRAINT "editing_configs_bgm_volume_check" CHECK ("bgmVolume" >= 0 AND "bgmVolume" <= 100)
);

-- CreateIndex
CREATE UNIQUE INDEX "editing_configs_jobId_key" ON "editing_configs"("jobId");

-- CreateIndex
CREATE INDEX "editing_configs_pipAssetId_idx" ON "editing_configs"("pipAssetId");

-- CreateIndex
CREATE INDEX "editing_configs_backgroundAssetId_idx" ON "editing_configs"("backgroundAssetId");

-- CreateIndex
CREATE INDEX "editing_configs_previewArtifactId_idx" ON "editing_configs"("previewArtifactId");

-- AddForeignKey
ALTER TABLE "editing_configs" ADD CONSTRAINT "editing_configs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_configs" ADD CONSTRAINT "editing_configs_pipAssetId_fkey" FOREIGN KEY ("pipAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_configs" ADD CONSTRAINT "editing_configs_backgroundAssetId_fkey" FOREIGN KEY ("backgroundAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editing_configs" ADD CONSTRAINT "editing_configs_previewArtifactId_fkey" FOREIGN KEY ("previewArtifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
