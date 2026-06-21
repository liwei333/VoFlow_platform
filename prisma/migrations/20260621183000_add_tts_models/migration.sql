CREATE TYPE "VoiceType" AS ENUM ('preset', 'cloned');
CREATE TYPE "VoiceStatus" AS ENUM ('active', 'disabled');
CREATE TYPE "TtsRequestStatus" AS ENUM ('queued', 'processing', 'succeeded', 'failed', 'waiting_approval');

CREATE TABLE "voices" (
  "id" TEXT NOT NULL,
  "teamId" TEXT,
  "ownerId" TEXT,
  "voiceType" "VoiceType" NOT NULL DEFAULT 'preset',
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "status" "VoiceStatus" NOT NULL DEFAULT 'active',
  "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'approved',
  "sampleUrl" TEXT,
  "gender" TEXT,
  "style" TEXT,
  "language" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "voices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tts_requests" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "nodeId" TEXT,
  "voiceId" TEXT NOT NULL,
  "scriptCandidateId" TEXT NOT NULL,
  "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "pitch" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pauseJson" JSONB,
  "provider" TEXT NOT NULL,
  "providerRequestId" TEXT,
  "status" "TtsRequestStatus" NOT NULL DEFAULT 'queued',
  "audioArtifactId" TEXT,
  "errorJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tts_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voices_teamId_createdAt_idx" ON "voices"("teamId", "createdAt");
CREATE INDEX "voices_teamId_status_idx" ON "voices"("teamId", "status");
CREATE INDEX "voices_voiceType_idx" ON "voices"("voiceType");
CREATE INDEX "voices_licenseStatus_idx" ON "voices"("licenseStatus");

CREATE INDEX "tts_requests_jobId_idx" ON "tts_requests"("jobId");
CREATE INDEX "tts_requests_nodeId_idx" ON "tts_requests"("nodeId");
CREATE INDEX "tts_requests_voiceId_idx" ON "tts_requests"("voiceId");
CREATE INDEX "tts_requests_scriptCandidateId_idx" ON "tts_requests"("scriptCandidateId");
CREATE INDEX "tts_requests_status_idx" ON "tts_requests"("status");

ALTER TABLE "voices" ADD CONSTRAINT "voices_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voices" ADD CONSTRAINT "voices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "workflow_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_voiceId_fkey" FOREIGN KEY ("voiceId") REFERENCES "voices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_scriptCandidateId_fkey" FOREIGN KEY ("scriptCandidateId") REFERENCES "script_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_audioArtifactId_fkey" FOREIGN KEY ("audioArtifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_speed_check" CHECK ("speed" >= 0.5 AND "speed" <= 2.0);
ALTER TABLE "tts_requests" ADD CONSTRAINT "tts_requests_pitch_check" CHECK ("pitch" >= -12 AND "pitch" <= 12);
