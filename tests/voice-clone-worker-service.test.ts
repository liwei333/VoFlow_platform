import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createVoiceCloneWorkflowNodeHandler } from "@/services/voiceCloneWorkerService";
import { VoiceTrainerError } from "@/services/voiceTrainerService";

const PASSED_QUALITY_REPORT = {
  passed: true,
  durationMs: 12000,
  averageVolumeDb: -18,
  silenceRatio: 0.05,
  noiseLevel: 0.1,
  reasons: [],
};

describe("voice clone workflow worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let assetId: string;
  let voiceSampleId: string;
  let voiceCloneJobId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `voice_clone_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Voice Clone Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Voice Clone Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Voice Clone Worker Project",
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

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "voice_clone",
        status: "running",
        version: 1,
        input: {},
      },
    });
    nodeId = node.id;

    const asset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: "audio",
        name: "Voice Clone Worker Sample",
        storageUrl: `voflow/${teamId}/assets/voice-clone-worker-sample/raw/voice.wav`,
        mimeType: "audio/wav",
        sizeBytes: BigInt(5000),
        metadata: {
          sourceType: "voice_sample",
          durationMs: 12000,
          qualityReport: PASSED_QUALITY_REPORT,
        },
        licenseStatus: "approved",
      },
    });
    assetId = asset.id;

    const sample = await prisma.voiceSample.create({
      data: {
        teamId,
        ownerId: userId,
        assetId,
        durationMs: 12000,
        qualityReport: PASSED_QUALITY_REPORT,
      },
    });
    voiceSampleId = sample.id;

    const cloneJob = await prisma.voiceCloneJob.create({
      data: {
        workflowNodeId: nodeId,
        voiceSampleId,
        provider: "mock",
        status: "queued",
      },
    });
    voiceCloneJobId = cloneJob.id;

    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        input: {
          voiceCloneJobId,
          voiceSampleId,
          provider: "mock",
        },
      },
    });
  });

  afterEach(async () => {
    await prisma.voiceCloneJob.deleteMany({ where: { voiceSampleId } });
    await prisma.voice.deleteMany({ where: { teamId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voiceConsent.deleteMany({ where: { teamId } });
    await prisma.voiceSample.deleteMany({ where: { teamId } });
    await prisma.asset.deleteMany({ where: { teamId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("runs the trainer, creates a cloned voice, links it to the job, and returns model metadata", async () => {
    const storage = {
      downloadObject: vi.fn(async () => Buffer.from("voice audio")),
    };
    const trainerFactory = vi.fn(() => ({
      train: async () => ({
        provider: "mock",
        modelId: "mock-model-1",
        sampleUrl: "mock://sample.wav",
        logs: [{ level: "info" as const, message: "training finished" }],
        providerRequestId: "mock-request-1",
      }),
    }));
    const handler = createVoiceCloneWorkflowNodeHandler({
      storage,
      trainerFactory,
    });

    const result = await handler({
      payload: {
        jobId,
        nodeId,
        nodeType: "voice_clone",
        version: 1,
        traceId: "trace-voice-clone-worker",
      },
      input: {
        voiceCloneJobId,
        voiceSampleId,
        provider: "mock",
      },
    });

    expect(storage.downloadObject).toHaveBeenCalledWith(
      `voflow/${teamId}/assets/voice-clone-worker-sample/raw/voice.wav`
    );
    expect(trainerFactory).toHaveBeenCalledWith("mock", undefined);
    expect(result).toMatchObject({
      status: "waiting_approval",
      requiresApproval: true,
      output: {
        voiceCloneJobId,
        voiceSampleId,
        voiceId: expect.any(String),
        provider: "mock",
        modelId: "mock-model-1",
        sampleUrl: "mock://sample.wav",
        logs: [{ level: "info", message: "training finished" }],
        providerRequestId: "mock-request-1",
      },
    });

    const updatedJob = await prisma.voiceCloneJob.findUnique({ where: { id: voiceCloneJobId } });
    expect(updatedJob).toMatchObject({
      status: "succeeded",
      errorJson: null,
      outputVoiceId: expect.any(String),
    });

    const clonedVoice = await prisma.voice.findUnique({
      where: { id: updatedJob?.outputVoiceId ?? "" },
    });
    expect(clonedVoice).toMatchObject({
      teamId,
      ownerId: userId,
      voiceType: "cloned",
      name: "Voice Clone Worker Sample 克隆音色",
      provider: "mock",
      modelId: "mock-model-1",
      status: "active",
      licenseStatus: "approved",
      sampleUrl: "mock://sample.wav",
      metadata: {
        voiceCloneJobId,
        voiceSampleId,
        sampleAssetId: assetId,
        providerRequestId: "mock-request-1",
        trainerLogs: [{ level: "info", message: "training finished" }],
      },
    });
  });

  it("writes error_json before rethrowing trainer failures", async () => {
    const handler = createVoiceCloneWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("voice audio"),
      },
      trainerFactory: () => ({
        train: async () => {
          throw new VoiceTrainerError("VOICE_CLONE_TRAINING_FAILED", "训练失败");
        },
      }),
    });

    await expect(
      handler({
        payload: {
          jobId,
          nodeId,
          nodeType: "voice_clone",
          version: 1,
          traceId: "trace-voice-clone-failed",
        },
        input: {
          voiceCloneJobId,
          voiceSampleId,
          provider: "mock",
        },
      })
    ).rejects.toMatchObject({
      code: "VOICE_CLONE_TRAINING_FAILED",
      message: "训练失败",
    });

    const updatedJob = await prisma.voiceCloneJob.findUnique({ where: { id: voiceCloneJobId } });
    expect(updatedJob).toMatchObject({
      status: "failed",
      errorJson: {
        code: "VOICE_CLONE_TRAINING_FAILED",
        message: "训练失败",
      },
    });
  });
});
