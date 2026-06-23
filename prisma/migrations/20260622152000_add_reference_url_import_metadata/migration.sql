ALTER TYPE "ReferenceSourceStatus" ADD VALUE 'metadata_ready';

CREATE TYPE "ReferenceImportMode" AS ENUM ('metadata_only', 'subtitle_only', 'audio_extract', 'uploaded_asset');

CREATE TYPE "ReferenceConsentStatus" AS ENUM ('pending', 'confirmed', 'rejected');

ALTER TABLE "reference_sources"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "metadataJson" JSONB,
  ADD COLUMN "subtitleJson" JSONB,
  ADD COLUMN "importMode" "ReferenceImportMode",
  ADD COLUMN "consentStatus" "ReferenceConsentStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "consentConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "consentConfirmedBy" TEXT;
