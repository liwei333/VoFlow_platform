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
    await prisma.referenceSource.deleteMany({ where: { projectId } });
    await prisma.script.deleteMany({ where: { projectId } });
    await prisma.workflowNode.deleteMany({
      where: {
        job: {
          projectId,
        },
      },
    });
    await prisma.videoJob.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { teamId } });
    await prisma.assetConsent.deleteMany({ where: { teamId } });
    await prisma.asset.deleteMany({ where: { teamId } });
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

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        teamId,
        targetType: "reference_source",
        targetId: referenceSourceId,
      },
    });
    expect(auditLog).toMatchObject({
      action: "reference_url_import",
      userId,
      metadata: {
        status: "succeeded",
        importMode: "subtitle_only",
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        platform: "youtube",
        ytDlpVersion: null,
        failureReason: null,
      },
    });
  });

  it("extracts authorized URL audio into an audio Asset and queues reference_extract", async () => {
    await prisma.referenceSource.update({
      where: { id: referenceSourceId },
      data: {
        importMode: "audio_extract",
        durationMs: 46_000,
        subtitleJson: null,
      },
    });
    const audioBuffer = Buffer.from("fake audio content");
    const audioExtractor = {
      extractAudio: vi.fn().mockResolvedValue({
        content: audioBuffer,
        fileName: "reference-audio.m4a",
        mimeType: "audio/mp4",
        sizeBytes: audioBuffer.byteLength,
      }),
    };
    const assetStorage = {
      uploadAsset: vi.fn().mockResolvedValue("voflow/test/assets/audio.m4a"),
    };
    const referenceExtractTask = vi.fn().mockResolvedValue({
      success: true,
      data: {
        referenceSource: {
          id: "reference-extract-source-id",
          projectId,
          teamId,
          sourceType: "asset",
          assetId: "created-asset-id",
          status: "transcribing",
          durationMs: 46_000,
        },
        job: {
          id: "reference-extract-job-id",
          projectId,
          teamId,
          ownerId: userId,
          status: "queued",
          currentNode: "reference_extract",
        },
        node: {
          id: "reference-extract-node-id",
          jobId: "reference-extract-job-id",
          nodeType: "reference_extract",
          status: "queued",
          version: 1,
          input: {},
        },
      },
    });
    const handler = createReferenceUrlImportWorkflowNodeHandler({
      audioExtractor,
      assetStorage,
      referenceExtractTask,
      config: {
        enabled: true,
        ytdlpBin: "yt-dlp",
        timeoutMs: 60_000,
        maxDurationMs: 180_000,
        maxAudioBytes: 50 * 1024 * 1024,
        maxMetadataBytes: 2 * 1024 * 1024,
        maxSubtitleBytes: 5 * 1024 * 1024,
        allowAudioExtract: true,
        allowFullVideoDownload: false,
        allowedPlatforms: ["youtube"],
      },
    });

    const result = await handler({
      payload: createPayload(),
      input: {
        ...createNodeInput(),
        importMode: "audio_extract",
      },
    });

    expect(result.output).toMatchObject({
      sourceType: "reference_url_import",
      referenceSourceId,
      importMode: "audio_extract",
      stage: "transcribing",
      status: "queued_reference_extract",
      assetId: expect.any(String),
      referenceExtractJobId: "reference-extract-job-id",
      referenceExtractNodeId: "reference-extract-node-id",
    });
    expect(audioExtractor.extractAudio).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=demo",
      expect.objectContaining({
        maxAudioBytes: 50 * 1024 * 1024,
        traceId: "trace-reference-url-worker",
      })
    );
    expect(assetStorage.uploadAsset).toHaveBeenCalledWith(
      teamId,
      expect.any(String),
      "reference-audio.m4a",
      audioBuffer,
      "audio/mp4",
      audioBuffer.byteLength
    );
    const assetId = referenceExtractTask.mock.calls[0]?.[0]?.assetId;
    expect(referenceExtractTask).toHaveBeenCalledWith(
      {
        projectId,
        teamId,
        userId,
        assetId,
        usageScope: "reference_analysis_only",
      }
    );

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { consents: true },
    });
    expect(asset).toMatchObject({
      teamId,
      ownerId: userId,
      type: "audio",
      name: "YouTube 参考 - reference audio",
      storageUrl: "voflow/test/assets/audio.m4a",
      mimeType: "audio/mp4",
      sizeBytes: BigInt(audioBuffer.byteLength),
      licenseStatus: "approved",
      metadata: {
        sourceType: "reference_url_import",
        referenceSourceId,
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        platform: "youtube",
        durationMs: 46_000,
        importMode: "audio_extract",
      },
    });
    expect(asset?.consents).toHaveLength(1);
    expect(asset?.consents[0]).toMatchObject({
      teamId,
      userId,
      consentType: "reference_analysis_only",
      consentText: "reference_analysis_only",
      usageScope: ["reference_analysis_only"],
    });

    const referenceSource = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
    });
    expect(referenceSource).toMatchObject({
      status: "transcribing",
      assetId,
      errorJson: null,
    });
  });

  it("rejects audio extraction when reference URL import is disabled at worker time", async () => {
    await prisma.referenceSource.update({
      where: { id: referenceSourceId },
      data: {
        importMode: "audio_extract",
        durationMs: 46_000,
      },
    });
    const audioExtractor = {
      extractAudio: vi.fn(),
    };
    const handler = createReferenceUrlImportWorkflowNodeHandler({
      audioExtractor,
      assetStorage: {
        uploadAsset: vi.fn(),
      },
      referenceExtractTask: vi.fn(),
      config: {
        enabled: false,
        ytdlpBin: "yt-dlp",
        timeoutMs: 60_000,
        maxDurationMs: 180_000,
        maxAudioBytes: 50 * 1024 * 1024,
        maxMetadataBytes: 2 * 1024 * 1024,
        maxSubtitleBytes: 5 * 1024 * 1024,
        allowAudioExtract: true,
        allowFullVideoDownload: false,
        allowedPlatforms: ["youtube"],
      },
    });

    await expect(
      handler({
        payload: createPayload(),
        input: {
          ...createNodeInput(),
          importMode: "audio_extract",
        },
      })
    ).rejects.toMatchObject({
      code: "REFERENCE_URL_IMPORT_DISABLED",
    });
    expect(audioExtractor.extractAudio).not.toHaveBeenCalled();

    const referenceSource = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
    });
    expect(referenceSource?.errorJson).toMatchObject({
      code: "REFERENCE_URL_IMPORT_DISABLED",
    });

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        teamId,
        targetType: "reference_source",
        targetId: referenceSourceId,
      },
    });
    expect(auditLog).toMatchObject({
      action: "reference_url_import",
      userId,
      metadata: {
        status: "failed",
        importMode: "audio_extract",
        sourceUrl: "https://www.youtube.com/watch?v=demo",
        platform: "youtube",
        ytDlpVersion: null,
        failureReason: {
          code: "REFERENCE_URL_IMPORT_DISABLED",
        },
      },
    });
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
