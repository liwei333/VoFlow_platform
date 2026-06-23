import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { createReferenceUrlImportWorkflowNodeHandler } from "@/services/referenceUrlImportWorkerService";

describe("reference_url_import worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let referenceSourceId: string;
  let jobId: string;
  let nodeId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_url_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference URL Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference URL Worker Team",
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

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Reference URL Worker Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const referenceSource = await prisma.referenceSource.create({
      data: {
        projectId,
        teamId,
        sourceType: "url",
        platform: "youtube",
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        status: "pending",
        durationMs: 45_000,
        title: "YouTube 参考",
        subtitleJson: {
          subtitles: {
            zh: [{ ext: "vtt", url: "https://caption.example.com/zh.vtt" }],
          },
          automaticCaptions: {
            en: [{ ext: "vtt", url: "https://caption.example.com/en-auto.vtt" }],
          },
        },
        importMode: "subtitle_only",
        consentStatus: "confirmed",
        consentConfirmedAt: new Date("2026-06-23T00:00:00.000Z"),
        consentConfirmedBy: userId,
      },
    });
    referenceSourceId = referenceSource.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "running",
        currentNode: "reference_url_import",
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "reference_url_import",
        status: "running",
        input: createNodeInput(),
      },
    });
    nodeId = node.id;
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: {
        script: {
          projectId,
        },
      },
    });
    await prisma.referenceSource.deleteMany({ where: { id: referenceSourceId } });
    await prisma.script.deleteMany({ where: { projectId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("imports preferred subtitles into Script, AsrSegment, and reference structureJson", async () => {
    const subtitleDownloader = {
      downloadSubtitle: vi.fn().mockResolvedValue(
        [
          "WEBVTT",
          "",
          "00:00:01.000 --> 00:00:03.000",
          "第一句参考口播",
          "",
          "00:00:03.500 --> 00:00:06.000",
          "第二句成交提醒",
        ].join("\n")
      ),
    };
    const structureProvider = {
      analyzeStructure: vi.fn().mockResolvedValue({
        provider: "test-structure-provider",
        modelName: "test-model",
        structure: {
          hook: "第一句参考口播",
          rhythm: ["痛点", "成交提醒"],
          sellingPoints: ["高转化"],
          targetAudience: "内容运营",
        },
      }),
    };
    const handler = createReferenceUrlImportWorkflowNodeHandler({
      subtitleDownloader,
      structureProvider,
    });

    const result = await handler({
      payload: createPayload(),
      input: createNodeInput(),
    });

    expect(result.output).toMatchObject({
      sourceType: "reference_url_import",
      referenceSourceId,
      importMode: "subtitle_only",
      stage: "structuring",
      status: "succeeded",
      scriptId: expect.any(String),
      segmentCount: 2,
      structure: {
        hook: "第一句参考口播",
        rhythm: ["痛点", "成交提醒"],
        sellingPoints: ["高转化"],
        targetAudience: "内容运营",
      },
    });
    expect(subtitleDownloader.downloadSubtitle).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "subtitles",
        language: "zh",
        ext: "vtt",
        url: "https://caption.example.com/zh.vtt",
      }),
      expect.objectContaining({
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        traceId: "trace-reference-url-worker",
      })
    );
    expect(structureProvider.analyzeStructure).toHaveBeenCalledWith(
      {
        transcript: "第一句参考口播\n第二句成交提醒",
        segments: [
          { startMs: 1_000, endMs: 3_000, text: "第一句参考口播" },
          { startMs: 3_500, endMs: 6_000, text: "第二句成交提醒" },
        ],
      },
      expect.objectContaining({
        traceId: "trace-reference-url-worker",
      })
    );

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
      status: "succeeded",
      structureJson: {
        hook: "第一句参考口播",
        rhythm: ["痛点", "成交提醒"],
        sellingPoints: ["高转化"],
        targetAudience: "内容运营",
        provider: "test-structure-provider",
        modelName: "test-model",
      },
      errorJson: null,
    });
    expect(referenceSource?.transcriptScript).toMatchObject({
      projectId,
      jobId,
      sourceType: "asr",
      content: "第一句参考口播\n第二句成交提醒",
      status: "ready",
      metadata: {
        sourceType: "reference_url_import",
        referenceSourceId,
        importMode: "subtitle_only",
        subtitleTrack: {
          kind: "subtitles",
          language: "zh",
          ext: "vtt",
          url: "https://caption.example.com/zh.vtt",
        },
      },
    });
    expect(referenceSource?.transcriptScript?.asrSegments).toMatchObject([
      { startMs: 1_000, endMs: 3_000, text: "第一句参考口播" },
      { startMs: 3_500, endMs: 6_000, text: "第二句成交提醒" },
    ]);
  });

  function createPayload(): WorkflowQueuePayload {
    return {
      jobId,
      nodeId,
      nodeType: "reference_url_import",
      version: 1,
      traceId: "trace-reference-url-worker",
    };
  }

  function createNodeInput() {
    return {
      sourceType: "reference_url_import",
      referenceSourceId,
      projectId,
      teamId,
      userId,
      sourceUrl: "https://www.youtube.com/watch?v=demo",
      platform: "youtube",
      importMode: "subtitle_only",
    };
  }
});
