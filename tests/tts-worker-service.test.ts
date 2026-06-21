import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { TTS_LOCAL_PROVIDER } from "@/lib/tts/constants";
import { createTtsWorkflowNodeHandler } from "@/services/ttsWorkerService";

describe("TTS workflow worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let scriptId: string;
  let candidateId: string;
  let voiceId: string;
  let ttsRequestId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `tts_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "TTS Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "TTS Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "TTS Worker Project",
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
        currentNode: "tts",
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "tts",
        status: "running",
        version: 1,
        input: {},
      },
    });
    nodeId = node.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "pasted",
        content: "确认后的口播文案",
        version: 1,
        status: "approved",
      },
    });
    scriptId = script.id;

    const candidate = await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "确认后的口播文案",
        version: 1,
        status: "approved",
      },
    });
    candidateId = candidate.id;

    const voice = await prisma.voice.create({
      data: {
        teamId: null,
        ownerId: null,
        voiceType: "preset",
        name: "本地音色",
        provider: TTS_LOCAL_PROVIDER,
        modelId: "local-voice",
        status: "active",
        licenseStatus: "approved",
      },
    });
    voiceId = voice.id;

    const ttsRequest = await prisma.ttsRequest.create({
      data: {
        jobId,
        nodeId,
        voiceId,
        scriptCandidateId: candidateId,
        speed: 1,
        pitch: 0,
        provider: TTS_LOCAL_PROVIDER,
        status: "queued",
      },
    });
    ttsRequestId = ttsRequest.id;

    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        input: {
          ttsRequestId,
        },
      },
    });

    await prisma.localModelService.upsert({
      where: { serviceType: "tts" },
      update: {
        name: "TTS 语音",
        baseUrl: "http://localhost:5000",
        status: "online",
      },
      create: {
        serviceType: "tts",
        name: "TTS 语音",
        baseUrl: "http://localhost:5000",
        status: "online",
      },
    });
  });

  afterEach(async () => {
    await prisma.ttsRequest.deleteMany({ where: { jobId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voice.deleteMany({ where: { id: voiceId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("passes the registered TTS local model service into the local provider", async () => {
    const providerFactory = vi.fn(() => ({
      synthesize: async () => ({
        audioBuffer: Buffer.from("local wav"),
        contentType: "audio/wav",
        fileExtension: "wav",
        metadata: {
          durationMs: 1200,
          sampleRate: 16000,
          format: "wav",
        },
        providerRequestId: "local-request-1",
      }),
    }));
    const uploadArtifact = vi.fn(async () => "artifacts/team/job/tts.wav");
    const writeArtifact = vi.fn(async (data) =>
      prisma.artifact.create({
        data: {
          jobId: data.jobId,
          nodeId: data.nodeId,
          type: data.type,
          storageUrl: data.storageUrl,
          metadata: data.metadata as never,
        },
      })
    );

    const handler = createTtsWorkflowNodeHandler({
      providerFactory,
      uploadArtifact,
      writeArtifact,
    });

    await handler({
      payload: {
        jobId,
        nodeId,
        nodeType: "tts",
        version: 1,
        traceId: "trace-tts-worker",
      },
      input: {
        ttsRequestId,
      },
    });

    expect(providerFactory).toHaveBeenCalledWith(
      TTS_LOCAL_PROVIDER,
      expect.objectContaining({
        baseUrl: "http://localhost:5000",
        status: "online",
      })
    );
  });
});
