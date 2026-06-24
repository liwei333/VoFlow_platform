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
import { AvatarRenderOutputValidationError } from "@/lib/avatar-render/output-validation";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { prisma } from "@/lib/db";
import {
  createPreviewAvatarRenderTask,
  validateAvatarRenderInput,
} from "@/services/avatarRenderService";
import { createAvatarRenderWorkflowNodeHandler } from "@/services/avatarRenderWorkerService";
import type { AvatarRenderProvider } from "@/services/avatarRenderProviderService";
import { executeWorkflowNode } from "@/services/workflowWorkerService";

const PASSED_AVATAR_QUALITY = {
  passed: true,
  faceCount: 1,
  confidence: 0.98,
};

describe("avatar render Task 11 acceptance coverage", () => {
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

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `avatar_render_acceptance_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar Render Acceptance User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar Render Acceptance Team",
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
        name: "Avatar Render Acceptance Project",
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

  it("rejects avatar not ready before creating render requests or nodes", async () => {
    await prisma.avatar.update({
      where: { id: avatarId },
      data: { status: "draft" },
    });

    const result = await createPreviewAvatarRenderTask({
      jobId,
      teamId,
      avatarId,
      audioArtifactId,
      aspectRatio: "9:16",
      crop: "half_body",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: AVATAR_RENDER_ERROR_CODES.avatarNotReady,
        message: "数字人不可用",
      },
    });
    await expect(prisma.avatarRenderRequest.count({ where: { jobId } })).resolves.toBe(0);
    await expect(
      prisma.workflowNode.count({ where: { jobId, nodeType: AVATAR_RENDER_NODE_TYPE } })
    ).resolves.toBe(0);
  });

  it("rejects missing TTS audio artifacts before creating render requests or nodes", async () => {
    const result = await validateAvatarRenderInput({
      jobId,
      teamId,
      avatarId,
      audioArtifactId: "missing-audio-artifact",
      aspectRatio: "9:16",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: AVATAR_RENDER_ERROR_CODES.ttsAudioNotFound,
        message: "TTS 音频不存在",
      },
    });
    await expect(prisma.avatarRenderRequest.count({ where: { jobId } })).resolves.toBe(0);
    await expect(
      prisma.workflowNode.count({ where: { jobId, nodeType: AVATAR_RENDER_NODE_TYPE } })
    ).resolves.toBe(0);
  });

  it("writes an avatar_video artifact from the mock provider output", async () => {
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
        createTraceId: () => "trace-avatar-render-acceptance",
      }
    );
    if (!previewTask.success) {
      throw new Error(previewTask.error.message);
    }

    const outputVideo = Buffer.alloc(AVATAR_RENDER_MIN_OUTPUT_BYTES + 1, 1);
    const handler = createAvatarRenderWorkflowNodeHandler({
      storage: {
        downloadObject: async (storageUrl) =>
          storageUrl.endsWith("avatar-source.png")
            ? Buffer.from("avatar image")
            : Buffer.from("tts audio"),
      },
      providerFactory: () => ({
        renderAvatarVideo: vi.fn<AvatarRenderProvider["renderAvatarVideo"]>(async (payload) => ({
          provider: AVATAR_RENDER_MOCK_PROVIDER,
          videoPath: "/tmp/avatar-render/acceptance-preview.mp4",
          durationMs: 1800,
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
          model: AVATAR_RENDER_MOCK_MODEL,
          providerRequestId: "mock-render-acceptance",
          metadata: {
            mocked: true,
            mode: payload.mode,
            crop: payload.renderOptions.crop,
            aspectRatio: payload.aspectRatio,
            contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
            fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
          },
        })),
      }),
      readLocalAvatarService: async () => {
        throw new Error("mock provider should not read local avatar registry");
      },
      validateOutput: async () => ({
        videoBuffer: outputVideo,
        metadata: {
          sizeBytes: outputVideo.length,
          durationMs: 1800,
          expectedDurationMs: 1800,
          videoStreamCount: 1,
          codecName: "h264",
          contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
          fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
        },
      }),
      uploadArtifact: async () => "voflow/team/jobs/job-1/avatar_render/acceptance-preview.mp4",
    });

    const result = await executeWorkflowNode(
      {
        jobId,
        nodeId: previewTask.data.node.id,
        nodeType: AVATAR_RENDER_NODE_TYPE,
        version: 1,
        traceId: "trace-avatar-render-acceptance",
      },
      {
        handlers: {
          avatar_render: handler,
        },
      }
    );

    expect(result.success).toBe(true);
    const artifact = await prisma.artifact.findFirstOrThrow({
      where: {
        jobId,
        nodeId: previewTask.data.node.id,
        type: AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
      },
    });
    expect(artifact.storageUrl).toBe(
      "voflow/team/jobs/job-1/avatar_render/acceptance-preview.mp4"
    );
    expect(artifact.metadata).toMatchObject({
      provider: AVATAR_RENDER_MOCK_PROVIDER,
      providerRequestId: "mock-render-acceptance",
      mode: "preview",
      crop: "half_body",
      aspectRatio: "9:16",
      sizeBytes: outputVideo.length,
    });
    const node = await prisma.workflowNode.findUniqueOrThrow({
      where: { id: previewTask.data.node.id },
    });
    expect(node.status).toBe(WORKFLOW_NODE_STATUS.WAITING_APPROVAL);
  });

  it("marks avatar_render nodes failed when provider output validation fails", async () => {
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
        createTraceId: () => "trace-avatar-render-invalid-output",
      }
    );
    if (!previewTask.success) {
      throw new Error(previewTask.error.message);
    }

    const handler = createAvatarRenderWorkflowNodeHandler({
      storage: {
        downloadObject: async () => Buffer.from("input"),
      },
      providerFactory: () => ({
        renderAvatarVideo: async (payload) => ({
          provider: AVATAR_RENDER_MOCK_PROVIDER,
          videoPath: "/tmp/avatar-render/invalid.mp4",
          durationMs: 1800,
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
          model: AVATAR_RENDER_MOCK_MODEL,
          providerRequestId: "mock-render-invalid",
          metadata: {
            mode: payload.mode,
            crop: payload.renderOptions.crop,
            aspectRatio: payload.aspectRatio,
            contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
            fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
          },
        }),
      }),
      validateOutput: async () => {
        throw new AvatarRenderOutputValidationError(
          AVATAR_RENDER_ERROR_CODES.invalidProviderOutput
        );
      },
      uploadArtifact: async () => "unused",
    });

    const result = await executeWorkflowNode(
      {
        jobId,
        nodeId: previewTask.data.node.id,
        nodeType: AVATAR_RENDER_NODE_TYPE,
        version: 1,
        traceId: "trace-avatar-render-invalid-output",
      },
      {
        handlers: {
          avatar_render: handler,
        },
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: AVATAR_RENDER_ERROR_CODES.invalidProviderOutput,
        message: "数字人渲染输出无效",
      },
    });
    await expect(
      prisma.workflowNode.findUniqueOrThrow({
        where: { id: previewTask.data.node.id },
        select: {
          status: true,
          error: true,
        },
      })
    ).resolves.toEqual({
      status: WORKFLOW_NODE_STATUS.FAILED,
      error: {
        code: AVATAR_RENDER_ERROR_CODES.invalidProviderOutput,
        message: "数字人渲染输出无效",
      },
    });
    await expect(
      prisma.artifact.count({ where: { jobId, nodeId: previewTask.data.node.id } })
    ).resolves.toBe(0);
  });
});
