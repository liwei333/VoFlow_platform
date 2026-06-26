-- Add real OAuth token metadata and real publish remote state fields.
ALTER TABLE "channel_accounts"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerAccountId" TEXT,
  ADD COLUMN "encryptedAccessToken" TEXT,
  ADD COLUMN "encryptedRefreshToken" TEXT,
  ADD COLUMN "tokenType" TEXT,
  ADD COLUMN "scopesJson" JSONB,
  ADD COLUMN "metadataJson" JSONB,
  ADD COLUMN "lastAuthorizedAt" TIMESTAMP(3),
  ADD COLUMN "lastRefreshAt" TIMESTAMP(3),
  ADD COLUMN "lastErrorJson" JSONB;

ALTER TABLE "publishes"
  ADD COLUMN "remoteUrl" TEXT,
  ADD COLUMN "remoteStatus" JSONB,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "attemptsJson" JSONB;

CREATE INDEX "channel_accounts_provider_providerAccountId_idx"
  ON "channel_accounts"("provider", "providerAccountId");

CREATE INDEX "channel_accounts_lastRefreshAt_idx"
  ON "channel_accounts"("lastRefreshAt");

CREATE INDEX "publishes_lastSyncedAt_idx"
  ON "publishes"("lastSyncedAt");
