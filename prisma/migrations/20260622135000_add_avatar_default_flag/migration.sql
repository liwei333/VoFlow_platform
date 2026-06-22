ALTER TABLE "avatars" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "avatars_teamId_isDefault_idx" ON "avatars"("teamId", "isDefault");

CREATE UNIQUE INDEX "avatars_teamId_default_unique"
ON "avatars"("teamId")
WHERE "isDefault" = true AND "deletedAt" IS NULL;
