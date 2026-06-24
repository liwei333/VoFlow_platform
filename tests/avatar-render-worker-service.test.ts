import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AVATAR_RENDER_DEFAULT_RESOLUTIONS,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_MIN_OUTPUT_BYTES,
  AVATAR_RENDER_MOCK_MODEL,
  AVATAR_RENDER_MOCK_PROVIDER,
  AVATAR_RENDER_NODE_TYPE,
  AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
  AVATAR_RENDER_VIDEO_CONTENT_TYPE,
  AVATAR_RENDER_VIDEO_EXTENSION,
} from "@/lib/avatar-render/constants";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { prisma } from "@/lib/db";
import { createPreviewAvatarRenderTask } from "@/services/avatarRenderService";
import {
  AvatarRenderProviderError,
  type AvatarRenderProvider,
} from "@/services/avatarRenderProviderService";
import { AvatarRenderOutputValidationError } from "@/lib/avatar-render/output-validation";
import { createAvatarRenderWorkflowNodeHandler } from "@/services/avatarRenderWorkerService";
import { createDefaultWorkflowNodeHandlers } from "@/services/workflowWorkerService";

const PASSED_AVATAR_QUALITY = {
  passed: true,
  faceCount: 1,
  confidence: 0.98,
};

describe("Avatar render workflow worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let avatarId: string;
  let sourceAssetId: string;
  let audioArtifactId: string;
  let ttsNodeId: string;
  let voiceId: string;
  let scriptId: string;
  let candidateId: string;
  let avatarRenderNodeId: string;
  let avatarRenderRequestId: string;
  let avatarRenderNodeInput: unknown;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `avatar_render_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar Render Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar Render Worker Team",
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
        name: "Avatar Render Worker Project",
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

    const sourceAsset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: "avatar_source",
        name: "avatar-source.png",
        storageUrl: "voflow/team/assets/avatar-source.png",
        mimeType: "image/png",
        sizeBytes: BigInt(1024),
        licenseStatus: "approved",
        metadata: PASSED_AVATAR_QUALITY,
      },
    });
    sourceAssetId = sourceAsset.id;

    const avatar = await prisma.avatar.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Ready Avatar",
        sourceAssetId,
        status: "ready",
        licenseStatus: "approved",
        qualityReport: PASSED_AVATAR_QUALITY,
      },
    });
    avatarId = avatar.id;

    const ttsNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "tts",
        status: "succeeded",
        version: 1,
      },
    });
    ttsNodeId = ttsNode.id;

    const audioArtifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId: ttsNodeId,
        type: "audio",
        storageUrl: "voflow/team/jobs/job-1/tts/audio.wav",
        metadata: {
          durationMs: 1800,
          format: "wav",
        },
      },
    });
    audioArtifactId = audioArtifact.id;

    const voice = await prisma.voice.create({
      data: {
        teamId: null,
        ownerId: null,
        voiceType: "preset",
        name: "Mock Voice",
        provider: "mock",
        modelId: "mock-voice",
        status: "active",
        licenseStatus: "approved",
      },
    });
    voiceId = voice.id;

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

    await prisma.ttsRequest.create({
      data: {
        jobId,
        nodeId: ttsNodeId,
        voiceId,
        scriptCandidateId: candidateId,
        provider: "mock",
        status: "succeeded",
        audioArtifactId,
      },
    });

    const previewTask = await createPreviewAvatarRenderTask(
      {
        jobId,
        teamId,
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      },
      {
        queue: {
          enqueue: async () => undefined,
        },
        createTraceId: () => "trace-avatar-preview",
      }
    );
    if (!previewTask.success) {
      throw new Error(previewTask.error.message);
    }
    avatarRenderNodeId = previewTask.data.node.id;
    avatarRenderRequestId = previewTask.data.avatarRenderRequest.id;
    avatarRenderNodeInput = previewTask.data.node.input;
  });

  afterEach(async () => {
    await prisma.avatarRenderRequest.deleteMany({ where: { jobId } });
    await prisma.ttsRequest.deleteMany({ where: { jobId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.avatar.deleteMany({ where: { id: avatarId } });
    await prisma.asset.deleteMany({ where: { id: sourceAssetId } });
    await prisma.voice.deleteMany({ where: { id: voiceId } });
    await prisma.scriptCandidate.deleteMany({ where: { id: candidateId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { userId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("registers the avatar_render handler by default", () => {
    const handlers = createDefaultWorkflowNodeHandlers();

    expect(handlers.avatar_render).toBeTypeOf("function");
  });

  it("downloads render inputs, calls provider, uploads avatar_video, and writes artifact", async () => {
    const sourceImage = Buffer.from("avatar image");
    const audio = Buffer.from("tts audio");
    const outputVideo = Buffer.alloc(AVATAR_RENDER_MIN_OUTPUT_BYTES + 1, 1);
    const downloadObject = vi.fn(async (storageUrl: string) =>
      storageUrl.endsWith("avatar-source.png") ? sourceImage : audio
    );
    const uploadArtifact = vi.fn(async () => "voflow/team/jobs/job-1/avatar_render/render.mp4");
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
    const validateOutput = vi.fn(async () => ({
      videoBuffer: outputVideo,
      metadata: {
        sizeBytes: outputVideo.length,
        durationMs: 1200,
        expectedDurationMs: 1200,
        videoStreamCount: 1,
        codecName: "h264",
        contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
        fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
      },
    }));
    const renderAvatarVideo = vi.fn<AvatarRenderProvider["renderAvatarVideo"]>(async (payload) => ({
      provider: AVATAR_RENDER_MOCK_PROVIDER,
      videoPath: "/tmp/avatar-render/output.mp4",
      durationMs: 1200,
      resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
      model: AVATAR_RENDER_MOCK_MODEL,
      providerRequestId: "provider-render-1",
      metadata: {
        mode: payload.mode,
        crop: payload.renderOptions.crop,
        aspectRatio: payload.aspectRatio,
        contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
        fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
        mocked: true,
      },
    }));
    const providerFactory = vi.fn(() => ({ renderAvatarVideo }));

    const handler = createAvatarRenderWorkflowNodeHandler({
      storage: { downloadObject },
      providerFactory,
      validateOutput,
      uploadArtifact,
      writeArtifact,
    });

    const result = await handler({
      payload: {
        jobId,
        nodeId: avatarRenderNodeId,
        nodeType: AVATAR_RENDER_NODE_TYPE,
        version: 1,
        traceId: "trace-avatar-render-worker",
      },
      input: avatarRenderNodeInput,
    });

    expect(downloadObject).toHaveBeenCalledTimes(2);
    expect(downloadObject).toHaveBeenNthCalledWith(1, "voflow/team/assets/avatar-source.png");
    expect(downloadObject).toHaveBeenNthCalledWith(2, "voflow/team/jobs/job-1/tts/audio.wav");
    expect(providerFactory).toHaveBeenCalledWith(AVATAR_RENDER_MOCK_PROVIDER, undefined);
    expect(renderAvatarVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: avatarRenderRequestId,
        jobId,
        nodeId: avatarRenderNodeId,
        avatarId,
        sourceImageUrl: "voflow/team/assets/avatar-source.png",
        audioUrl: "voflow/team/jobs/job-1/tts/audio.wav",
        sourceImage,
        audio,
        mode: "preview",
        aspectRatio: "9:16",
        renderOptions: {
          crop: "half_body",
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
        },
        traceId: "trace-avatar-render-worker",
      })
    );
    expect(validateOutput).toHaveBeenCalledWith({
      videoPath: "/tmp/avatar-render/output.mp4",
      expectedDurationMs: 1200,
      contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
      fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
    });
    expect(uploadArtifact).toHaveBeenCalledWith(
      teamId,
      jobId,
      AVATAR_RENDER_NODE_TYPE,
      `${avatarRenderRequestId}.${AVATAR_RENDER_VIDEO_EXTENSION}`,
      outputVideo,
      AVATAR_RENDER_VIDEO_CONTENT_TYPE,
      outputVideo.length
    );
    expect(writeArtifact).toHaveBeenCalledWith({
      jobId,
      nodeId: avatarRenderNodeId,
      type: AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
      storageUrl: "voflow/team/jobs/job-1/avatar_render/render.mp4",
      metadata: expect.objectContaining({
        provider: AVATAR_RENDER_MOCK_PROVIDER,
        providerRequestId: "provider-render-1",
        durationMs: 1200,
        resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
        model: AVATAR_RENDER_MOCK_MODEL,
        mode: "preview",
        crop: "half_body",
        aspectRatio: "9:16",
        sizeBytes: outputVideo.length,
        expectedDurationMs: 1200,
        videoStreamCount: 1,
        codecName: "h264",
      }),
    });
    expect(result).toEqual({
      status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
      requiresApproval: true,
      output: {
        avatarRenderRequestId,
        videoArtifactId: expect.any(String),
        storageUrl: "voflow/team/jobs/job-1/avatar_render/render.mp4",
        provider: AVATAR_RENDER_MOCK_PROVIDER,
        providerRequestId: "provider-render-1",
        metadata: expect.objectContaining({
          durationMs: 1200,
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
        }),
      },
    });

    await expect(
      prisma.avatarRenderRequest.findUniqueOrThrow({ where: { id: avatarRenderRequestId } })
    ).resolves.toMatchObject({
      providerRequestId: "provider-render-1",
    });
    await expect(
      prisma.artifact.findFirstOrThrow({
        where: {
          jobId,
          nodeId: avatarRenderNodeId,
          type: AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
        },
      })
    ).resolves.toMatchObject({
      storageUrl: "voflow/team/jobs/job-1/avatar_render/render.mp4",
    });
  });

  it("preserves avatar provider error codes", async () => {
    const handler = createAvatarRenderWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("input"),
      },
      providerFactory: () => ({
        renderAvatarVideo: async () => {
          throw new AvatarRenderProviderError("AVATAR_PROVIDER_UNAVAILABLE");
        },
      }),
      uploadArtifact: async () => "unused",
      writeArtifact: async (data) =>
        prisma.artifact.create({
          data: {
            jobId: data.jobId,
            nodeId: data.nodeId,
            type: data.type,
            storageUrl: data.storageUrl,
            metadata: data.metadata as never,
          },
        }),
    });

    await expect(
      handler({
        payload: {
          jobId,
          nodeId: avatarRenderNodeId,
          nodeType: AVATAR_RENDER_NODE_TYPE,
          version: 1,
          traceId: "trace-avatar-render-worker",
        },
        input: avatarRenderNodeInput,
      })
    ).rejects.toMatchObject({
      code: "AVATAR_PROVIDER_UNAVAILABLE",
    });
  });

  it("rejects invalid provider output before upload and artifact writes", async () => {
    const uploadArtifact = vi.fn(async () => "unused");
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
    const validateOutput = vi.fn(async () => {
      throw new AvatarRenderOutputValidationError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
    });

    const handler = createAvatarRenderWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("input"),
      },
      providerFactory: () => ({
        renderAvatarVideo: async (payload) => ({
          provider: AVATAR_RENDER_MOCK_PROVIDER,
          videoPath: "/tmp/avatar-render/invalid.mp4",
          durationMs: 1200,
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
          model: AVATAR_RENDER_MOCK_MODEL,
          providerRequestId: "provider-render-invalid",
          metadata: {
            mode: payload.mode,
            crop: payload.renderOptions.crop,
            aspectRatio: payload.aspectRatio,
            contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
            fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
          },
        }),
      }),
      validateOutput,
      uploadArtifact,
      writeArtifact,
    });

    await expect(
      handler({
        payload: {
          jobId,
          nodeId: avatarRenderNodeId,
          nodeType: AVATAR_RENDER_NODE_TYPE,
          version: 1,
          traceId: "trace-avatar-render-worker",
        },
        input: avatarRenderNodeInput,
      })
    ).rejects.toMatchObject({
      code: AVATAR_RENDER_ERROR_CODES.invalidProviderOutput,
    } satisfies Partial<AvatarRenderOutputValidationError>);
    expect(uploadArtifact).not.toHaveBeenCalled();
    expect(writeArtifact).not.toHaveBeenCalled();
  });
});
