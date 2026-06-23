import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createVoiceCloneTrainingTask } from "@/services/voiceCloneService";

const PASSED_QUALITY_REPORT = {
  passed: true,
  durationMs: 12000,
  averageVolumeDb: -18,
  silenceRatio: 0.05,
  noiseLevel: 0.1,
  reasons: [],
};

const FAILED_QUALITY_REPORT = {
  ...PASSED_QUALITY_REPORT,
  passed: false,
  reasons: [{ code: "VOICE_SAMPLE_NOISY", message: "声音样本噪声过高" }],
};

describe("voice clone training task service", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `voice_clone_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Voice Clone User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Voice Clone Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Voice Clone Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "running",
        currentNode: "voice_clone",
      },
    });
    jobId = job.id;
  });

  afterEach(async () => {
    await prisma.voiceCloneJob.deleteMany({ where: { voiceSample: { teamId } } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voiceConsent.deleteMany({ where: { teamId } });
    await prisma.voiceSample.deleteMany({ where: { teamId } });
    await prisma.asset.deleteMany({ where: { teamId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("rejects training when the voice sample has not passed quality checks", async () => {
    const sample = await createVoiceSample({ qualityReport: FAILED_QUALITY_REPORT, withConsent: true });

    const result = await createVoiceCloneTrainingTask({
      jobId,
      voiceSampleId: sample.id,
      teamId,
      userId,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "VOICE_SAMPLE_QUALITY_NOT_PASSED",
        message: "声音样本质量未通过",
      },
    });
    await expect(prisma.workflowNode.count({ where: { jobId } })).resolves.toBe(0);
    await expect(prisma.voiceCloneJob.count({ where: { voiceSampleId: sample.id } })).resolves.toBe(0);
  });

  it("rejects training when voice consent is missing", async () => {
    const sample = await createVoiceSample({ qualityReport: PASSED_QUALITY_REPORT, withConsent: false });

    const result = await createVoiceCloneTrainingTask({
      jobId,
      voiceSampleId: sample.id,
      teamId,
      userId,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "VOICE_SAMPLE_CONSENT_REQUIRED",
        message: "请先确认声音授权",
      },
    });
    await expect(prisma.workflowNode.count({ where: { jobId } })).resolves.toBe(0);
    await expect(prisma.voiceCloneJob.count({ where: { voiceSampleId: sample.id } })).resolves.toBe(0);
  });

  it("creates a queued voice_clone workflow node and voice_clone_job for a qualified authorized sample", async () => {
    const sample = await createVoiceSample({ qualityReport: PASSED_QUALITY_REPORT, withConsent: true });
    const enqueued: unknown[] = [];

    const result = await createVoiceCloneTrainingTask(
      {
        jobId,
        voiceSampleId: sample.id,
        teamId,
        userId,
      },
      {
        queue: {
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-voice-clone",
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "voice_clone",
      status: "queued",
      version: 1,
      requiresApproval: true,
    });
    expect(result.success && result.data.voiceCloneJob).toMatchObject({
      voiceSampleId: sample.id,
      provider: "mock",
      status: "queued",
    });
    expect(result.success && result.data.node.input).toMatchObject({
      voiceCloneJobId: result.success && result.data.voiceCloneJob.id,
      voiceSampleId: sample.id,
      provider: "mock",
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "voice_clone",
        version: 1,
        traceId: "trace-voice-clone",
      },
    ]);

    const persistedJob = await prisma.videoJob.findUnique({ where: { id: jobId } });
    expect(persistedJob).toMatchObject({
      status: "queued",
      currentNode: "voice_clone",
    });
  });

  async function createVoiceSample(options: {
    qualityReport: typeof PASSED_QUALITY_REPORT;
    withConsent: boolean;
  }) {
    const asset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: "audio",
        name: "Voice Clone Sample",
        storageUrl: `voflow/${teamId}/assets/voice-clone-sample/raw/voice.wav`,
        mimeType: "audio/wav",
        sizeBytes: BigInt(5000),
        metadata: {
          sourceType: "voice_sample",
          durationMs: 12000,
          qualityReport: options.qualityReport,
        },
        licenseStatus: options.withConsent ? "approved" : "pending",
      },
    });

    const sample = await prisma.voiceSample.create({
      data: {
        teamId,
        ownerId: userId,
        assetId: asset.id,
        durationMs: 12000,
        qualityReport: options.qualityReport,
      },
    });

    if (options.withConsent) {
      await prisma.voiceConsent.create({
        data: {
          voiceSampleId: sample.id,
          teamId,
          userId,
          consentText: "我确认上传声音为本人声音或已获得合法授权，并同意用于声音克隆和 TTS 生成。",
          usageScope: ["voice_clone", "tts_generation"],
        },
      });
    }

    return sample;
  }
});
