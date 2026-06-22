-- CreateEnum
CREATE TYPE "AvatarStatus" AS ENUM ('draft', 'ready', 'disabled', 'deleted');

-- CreateTable
CREATE TABLE "avatars" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "provider" TEXT,
    "status" "AvatarStatus" NOT NULL DEFAULT 'draft',
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'pending',
    "qualityReport" JSONB,
    "previewUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "avatars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avatar_consents" (
    "id" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "usageScope" TEXT[],
    "ipAddress" TEXT,
    "device" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avatar_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "avatars_teamId_createdAt_idx" ON "avatars"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "avatars_teamId_status_idx" ON "avatars"("teamId", "status");

-- CreateIndex
CREATE INDEX "avatars_sourceAssetId_idx" ON "avatars"("sourceAssetId");

-- CreateIndex
CREATE INDEX "avatars_licenseStatus_idx" ON "avatars"("licenseStatus");

-- CreateIndex
CREATE INDEX "avatar_consents_avatarId_idx" ON "avatar_consents"("avatarId");

-- CreateIndex
CREATE INDEX "avatar_consents_teamId_idx" ON "avatar_consents"("teamId");

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatars" ADD CONSTRAINT "avatars_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_consents" ADD CONSTRAINT "avatar_consents_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "avatars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avatar_consents" ADD CONSTRAINT "avatar_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
