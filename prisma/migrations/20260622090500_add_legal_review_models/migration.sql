ALTER TYPE "AuditAction" ADD VALUE 'legal_risk_resolve';

CREATE TYPE "LegalReviewStatus" AS ENUM ('pending', 'reviewed', 'waiting_approval', 'approved');
CREATE TYPE "LegalRiskType" AS ENUM ('forbidden', 'sensitive', 'exaggeration', 'copyright', 'fact', 'platform_rule');
CREATE TYPE "LegalRiskSeverity" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "LegalRiskAction" AS ENUM ('pending', 'replaced', 'ignored', 'confirmed_safe');

CREATE TABLE "legal_reviews" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "scriptCandidateId" TEXT NOT NULL,
  "jobId" TEXT,
  "status" "LegalReviewStatus" NOT NULL DEFAULT 'pending',
  "summaryJson" JSONB,
  "reviewedScript" TEXT NOT NULL,
  "resolvedScript" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_risk_items" (
  "id" TEXT NOT NULL,
  "legalReviewId" TEXT NOT NULL,
  "riskType" "LegalRiskType" NOT NULL,
  "severity" "LegalRiskSeverity" NOT NULL,
  "originalText" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "suggestion" TEXT,
  "action" "LegalRiskAction" NOT NULL DEFAULT 'pending',
  "ignoredReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "legal_risk_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_reviews_teamId_createdAt_idx" ON "legal_reviews"("teamId", "createdAt");
CREATE INDEX "legal_reviews_scriptCandidateId_idx" ON "legal_reviews"("scriptCandidateId");
CREATE INDEX "legal_reviews_jobId_idx" ON "legal_reviews"("jobId");
CREATE INDEX "legal_reviews_status_idx" ON "legal_reviews"("status");

CREATE INDEX "legal_risk_items_legalReviewId_idx" ON "legal_risk_items"("legalReviewId");
CREATE INDEX "legal_risk_items_riskType_idx" ON "legal_risk_items"("riskType");
CREATE INDEX "legal_risk_items_severity_idx" ON "legal_risk_items"("severity");
CREATE INDEX "legal_risk_items_action_idx" ON "legal_risk_items"("action");

ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_scriptCandidateId_fkey" FOREIGN KEY ("scriptCandidateId") REFERENCES "script_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_reviews" ADD CONSTRAINT "legal_reviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "video_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legal_risk_items" ADD CONSTRAINT "legal_risk_items_legalReviewId_fkey" FOREIGN KEY ("legalReviewId") REFERENCES "legal_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
