import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MemoryWorkflowQueue } from "@/lib/queue/adapter";
import {
  REFERENCE_ASR_FAILED,
  createReferenceAsrWorkflowNodeHandler,
  createReferenceExtractTask,
} from "@/services/referenceAsrService";

describe("reference ASR task creation", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let assetId: string;
  const jobIds: string[] = [];
  const referenceSourceIds: string[] = [];

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_asr_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference ASR User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference ASR Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
      },
    });

    projectId = (
      await prisma.project.create({
        data: {
          teamId,
          ownerId: userId,
          name: "Reference ASR Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;

    const asset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: "audio",
        name: "reference.wav",
        storageUrl: "voflow/reference/assets/reference.wav",
        mimeType: "audio/wav",
        sizeBytes: BigInt(1024),
        metadata: { durationMs: 2200 },
        licenseStatus: "approved",
      },
    });
    assetId = asset.id;

    await prisma.assetConsent.create({
      data: {
        assetId,
        teamId,
        userId,
        consentType: "asset_license",
        consentText: "reference asr consent",
        usageScope: ["video_generation"],
      },
    });
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: {
        script: {
          jobId: { in: jobIds },
        },
      },
    });
    await prisma.script.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.referenceSource.deleteMany({ where: { id: { in: referenceSourceIds } } });
    await prisma.workflowNode.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.videoJob.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.assetConsent.deleteMany({ where: { assetId } });
    await prisma.asset.deleteMany({ where: { id: assetId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates a reference source, queued reference_extract node, and payload", async () => {
    const queue = new MemoryWorkflowQueue();

    const result = await createReferenceExtractTask(
      {
        projectId,
        teamId,
        userId,
        assetId,
      },
      {
        queue,
        createTraceId: () => "trace-reference-1",
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.code);
    }

    jobIds.push(result.data.job.id);
    referenceSourceIds.push(result.data.referenceSource.id);

    expect(result.data.job).toMatchObject({
      projectId,
      teamId,
      ownerId: userId,
      status: "queued",
      currentNode: "reference_extract",
    });
    expect(result.data.referenceSource).toMatchObject({
      projectId,
      teamId,
      sourceType: "asset",
      assetId,
      status: "transcribing",
      durationMs: 2200,
    });
    expect(result.data.node).toMatchObject({
      jobId: result.data.job.id,
      nodeType: "reference_extract",
      status: "queued",
      version: 1,
      input: {
        sourceType: "asset",
        projectId,
        teamId,
        referenceSourceId: result.data.referenceSource.id,
        assetId,
        assetType: "audio",
        storageUrl: "voflow/reference/assets/reference.wav",
        durationMs: 2200,
      },
    });
    expect(queue.getQueue()).toEqual([
      {
        jobId: result.data.job.id,
        nodeId: result.data.node.id,
        nodeType: "reference_extract",
        version: 1,
        traceId: "trace-reference-1",
      },
    ]);
  });
});

describe("reference ASR worker handler", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let assetId: string;
  let jobId: string;
  let nodeId: string;
  let referenceSourceId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_asr_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference ASR Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference ASR Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    projectId = (
      await prisma.project.create({
        data: {
          teamId,
          ownerId: userId,
          name: "Reference ASR Worker Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;

    assetId = (
      await prisma.asset.create({
        data: {
          teamId,
          ownerId: userId,
          type: "audio",
          name: "worker.wav",
          storageUrl: "voflow/reference/assets/worker.wav",
          mimeType: "audio/wav",
          sizeBytes: BigInt(1024),
          metadata: { durationMs: 2200 },
          licenseStatus: "approved",
        },
      })
    ).id;

    jobId = (
      await prisma.videoJob.create({
        data: {
          projectId,
          teamId,
          ownerId: userId,
          status: "running",
          currentNode: "reference_extract",
        },
      })
    ).id;

    nodeId = (
      await prisma.workflowNode.create({
        data: {
          jobId,
          nodeType: "reference_extract",
          status: "running",
          version: 1,
        },
      })
    ).id;

    referenceSourceId = (
      await prisma.referenceSource.create({
        data: {
          projectId,
          teamId,
          sourceType: "asset",
          assetId,
          status: "transcribing",
          durationMs: 2200,
        },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: {
        script: {
          jobId,
        },
      },
    });
    await prisma.script.deleteMany({ where: { jobId } });
    await prisma.referenceSource.deleteMany({ where: { id: referenceSourceId } });
    await prisma.workflowNode.deleteMany({ where: { id: nodeId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.asset.deleteMany({ where: { id: assetId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("saves transcript text and segments to the reference source", async () => {
    const handler = createReferenceAsrWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("media-bytes"),
      },
      registry: {
        getAsrService: async () => ({
          serviceType: "asr",
          name: "ASR 转写",
          baseUrl: "http://localhost:6000",
          status: "online",
        }),
      },
      provider: {
        transcribe: async (input) => {
          expect(input.traceId).toBe("trace-reference-worker");
          expect(input.assetId).toBe(assetId);
          return {
            text: "欢迎来到 VoFlow",
            segments: [
              { startMs: 0, endMs: 1200, text: "欢迎来到" },
              { startMs: 1200, endMs: 2200, text: "VoFlow" },
            ],
            provider: "mock-asr",
          };
        },
      },
    });

    const result = await handler({
      payload: {
        jobId,
        nodeId,
        nodeType: "reference_extract",
        version: 1,
        traceId: "trace-reference-worker",
      },
      input: {
        sourceType: "asset",
        projectId,
        teamId,
        referenceSourceId,
        assetId,
        assetType: "audio",
        storageUrl: "voflow/reference/assets/worker.wav",
        durationMs: 2200,
      },
    });

    expect(result).toEqual({
      output: {
        sourceType: "asset",
        referenceSourceId,
        assetId,
        assetType: "audio",
        durationMs: 2200,
        text: "欢迎来到 VoFlow",
        segments: [
          { startMs: 0, endMs: 1200, text: "欢迎来到" },
          { startMs: 1200, endMs: 2200, text: "VoFlow" },
        ],
        provider: "mock-asr",
        scriptId: expect.any(String),
      },
    });

    const output = result.output as { scriptId: string };
    const referenceSource = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
      include: {
        transcriptScript: {
          include: {
            asrSegments: {
              orderBy: { startMs: "asc" },
            },
          },
        },
      },
    });

    expect(referenceSource).toMatchObject({
      status: "analyzing",
      transcriptScriptId: output.scriptId,
    });
    expect(referenceSource?.transcriptScript).toMatchObject({
      projectId,
      jobId,
      sourceType: "asr",
      content: "欢迎来到 VoFlow",
      metadata: {
        sourceType: "reference_extract",
        referenceSourceId,
        assetId,
        assetType: "audio",
        durationMs: 2200,
        provider: "mock-asr",
      },
    });
    expect(referenceSource?.transcriptScript?.asrSegments).toEqual([
      expect.objectContaining({ startMs: 0, endMs: 1200, text: "欢迎来到" }),
      expect.objectContaining({ startMs: 1200, endMs: 2200, text: "VoFlow" }),
    ]);
  });

  it("writes REFERENCE_ASR_FAILED when the ASR provider fails", async () => {
    const handler = createReferenceAsrWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("media-bytes"),
      },
      registry: {
        getAsrService: async () => ({
          serviceType: "asr",
          name: "ASR 转写",
          baseUrl: "http://localhost:6000",
          status: "online",
        }),
      },
      provider: {
        transcribe: async () => {
          throw new Error("asr timeout");
        },
      },
    });

    await expect(
      handler({
        payload: {
          jobId,
          nodeId,
          nodeType: "reference_extract",
          version: 1,
          traceId: "trace-reference-failed",
        },
        input: {
          sourceType: "asset",
          projectId,
          teamId,
          referenceSourceId,
          assetId,
          assetType: "audio",
          storageUrl: "voflow/reference/assets/worker.wav",
          durationMs: 2200,
        },
      })
    ).rejects.toMatchObject({
      code: REFERENCE_ASR_FAILED,
      message: "ASR 转写失败",
    });

    const referenceSource = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
    });
    expect(referenceSource).toMatchObject({
      status: "failed",
      errorJson: {
        code: REFERENCE_ASR_FAILED,
        message: "ASR 转写失败",
        detail: "asr timeout",
      },
    });
  });
});
