-- CreateTable
CREATE TABLE "voice_samples" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "durationMs" INTEGER,
    "qualityReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_consents" (
    "id" TEXT NOT NULL,
    "voiceSampleId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "usageScope" TEXT[],
    "ipAddress" TEXT,
    "device" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_clone_jobs" (
    "id" TEXT NOT NULL,
    "workflowNodeId" TEXT NOT NULL,
    "voiceSampleId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "WorkflowNodeStatus" NOT NULL DEFAULT 'queued',
    "outputVoiceId" TEXT,
    "errorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_clone_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_samples_teamId_createdAt_idx" ON "voice_samples"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_samples_assetId_idx" ON "voice_samples"("assetId");

-- CreateIndex
CREATE INDEX "voice_samples_ownerId_idx" ON "voice_samples"("ownerId");

-- CreateIndex
CREATE INDEX "voice_consents_voiceSampleId_idx" ON "voice_consents"("voiceSampleId");

-- CreateIndex
CREATE INDEX "voice_consents_teamId_idx" ON "voice_consents"("teamId");

-- CreateIndex
CREATE INDEX "voice_consents_userId_idx" ON "voice_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "voice_clone_jobs_workflowNodeId_key" ON "voice_clone_jobs"("workflowNodeId");

-- CreateIndex
CREATE INDEX "voice_clone_jobs_voiceSampleId_idx" ON "voice_clone_jobs"("voiceSampleId");

-- CreateIndex
CREATE INDEX "voice_clone_jobs_outputVoiceId_idx" ON "voice_clone_jobs"("outputVoiceId");

-- CreateIndex
CREATE INDEX "voice_clone_jobs_status_idx" ON "voice_clone_jobs"("status");

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_consents" ADD CONSTRAINT "voice_consents_voiceSampleId_fkey" FOREIGN KEY ("voiceSampleId") REFERENCES "voice_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_consents" ADD CONSTRAINT "voice_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_clone_jobs" ADD CONSTRAINT "voice_clone_jobs_workflowNodeId_fkey" FOREIGN KEY ("workflowNodeId") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_clone_jobs" ADD CONSTRAINT "voice_clone_jobs_voiceSampleId_fkey" FOREIGN KEY ("voiceSampleId") REFERENCES "voice_samples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_clone_jobs" ADD CONSTRAINT "voice_clone_jobs_outputVoiceId_fkey" FOREIGN KEY ("outputVoiceId") REFERENCES "voices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
