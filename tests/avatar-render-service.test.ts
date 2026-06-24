import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AVATAR_RENDER_DEFAULT_RESOLUTIONS } from "@/lib/avatar-render/constants";
import { prisma } from "@/lib/db";
import {
  approveAvatarRenderPreview,
  createHdAvatarRenderTask,
  createPreviewAvatarRenderTask,
  retryAvatarRenderPreview,
  validateAvatarRenderInput,
} from "@/services/avatarRenderService";

const PASSED_AVATAR_QUALITY = {
  passed: true,
  faceCount: 1,
  confidence: 0.98,
};

describe("avatar render input validation service", () => {
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
        email: `avatar_render_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar Render User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar Render Team",
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
        name: "Avatar Render Project",
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
        storageUrl: "s3://voflow/team/avatar-source.png",
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
        storageUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
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

  it("returns normalized render input when avatar, audio artifact, and aspect ratio are valid", async () => {
    const result = await validateAvatarRenderInput({
      jobId,
      teamId,
      avatarId,
      audioArtifactId,
      aspectRatio: "9:16",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        job: {
          id: jobId,
          projectId,
          teamId,
          aspectRatio: "9:16",
        },
        avatar: {
          id: avatarId,
          sourceImageUrl: "s3://voflow/team/avatar-source.png",
        },
        audioArtifact: {
          id: audioArtifactId,
          storageUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
          type: "audio",
        },
      },
    });
  });

  it("rejects avatars that are not ready", async () => {
    await prisma.avatar.update({
      where: { id: avatarId },
      data: { status: "draft" },
    });

    const result = await validateAvatarRenderInput({
      jobId,
      teamId,
      avatarId,
      audioArtifactId,
      aspectRatio: "9:16",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "AVATAR_NOT_READY",
        message: "数字人不可用",
      },
    });
  });

  it("rejects avatars without approved license", async () => {
    await prisma.avatar.update({
      where: { id: avatarId },
      data: { licenseStatus: "pending" },
    });

    const result = await validateAvatarRenderInput({
      jobId,
      teamId,
      avatarId,
      audioArtifactId,
      aspectRatio: "9:16",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "AVATAR_LICENSE_NOT_APPROVED",
        message: "数字人未授权",
      },
    });
  });

  it("rejects missing TTS audio artifacts", async () => {
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
        code: "TTS_AUDIO_NOT_FOUND",
        message: "TTS 音频不存在",
      },
    });
  });

  it("rejects aspect ratios that do not match the project", async () => {
    const result = await validateAvatarRenderInput({
      jobId,
      teamId,
      avatarId,
      audioArtifactId,
      aspectRatio: "16:9",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "AVATAR_RENDER_ASPECT_RATIO_MISMATCH",
        message: "渲染画面比例与项目不一致",
      },
    });
  });

  it("creates a preview avatar render request, workflow node, and queue payload", async () => {
    const enqueued: unknown[] = [];

    const result = await createPreviewAvatarRenderTask(
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
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-avatar-preview",
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "avatar_render",
      status: "queued",
      version: 1,
      requiresApproval: false,
      input: {
        avatarId,
        audioArtifactId,
        mode: "preview",
        aspectRatio: "9:16",
        sourceImageUrl: "s3://voflow/team/avatar-source.png",
        audioUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
        renderOptions: {
          crop: "half_body",
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
        },
      },
    });
    expect(result.success && result.data.avatarRenderRequest).toMatchObject({
      jobId,
      avatarId,
      audioArtifactId,
      mode: "preview",
      aspectRatio: "9:16",
      crop: "half_body",
      provider: "mock",
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "avatar_render",
        version: 1,
        traceId: "trace-avatar-preview",
      },
    ]);

    const persistedJob = await prisma.videoJob.findUnique({ where: { id: jobId } });
    expect(persistedJob).toMatchObject({
      status: "queued",
      currentNode: "avatar_render",
    });
  });

  it("approves a preview render and creates a queued hd render request", async () => {
    const enqueued: unknown[] = [];
    const preview = await createPreviewAvatarRenderTask(
      {
        jobId,
        teamId,
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      },
      {
        queue: { enqueue: async () => undefined },
        createTraceId: () => "trace-preview",
      }
    );
    if (!preview.success) {
      throw new Error(preview.error.message);
    }
    await prisma.workflowNode.update({
      where: { id: preview.data.node.id },
      data: {
        status: "waiting_approval",
        requiresApproval: true,
        output: {
          videoArtifactId: "preview-artifact-1",
        },
      },
    });

    const result = await approveAvatarRenderPreview(
      {
        jobId,
        teamId,
        userId,
        avatarRenderRequestId: preview.data.avatarRenderRequest.id,
      },
      {
        queue: {
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-avatar-hd",
        now: () => new Date("2026-06-23T12:00:00.000Z"),
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.previewNode).toMatchObject({
      id: preview.data.node.id,
      status: "approved",
      approvedByUserId: userId,
    });
    expect(result.success && result.data.avatarRenderRequest).toMatchObject({
      jobId,
      avatarId,
      audioArtifactId,
      mode: "hd",
      crop: "half_body",
      aspectRatio: "9:16",
      provider: "mock",
    });
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "avatar_render",
      status: "queued",
      version: 2,
      input: {
        mode: "hd",
        avatarId,
        audioArtifactId,
        sourceImageUrl: "s3://voflow/team/avatar-source.png",
        audioUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
        renderOptions: {
          crop: "half_body",
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd,
        },
      },
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "avatar_render",
        version: 2,
        traceId: "trace-avatar-hd",
      },
    ]);
  });

  it("retries an unsatisfactory preview by cancelling it and creating a new preview request", async () => {
    const enqueued: unknown[] = [];
    const preview = await createPreviewAvatarRenderTask(
      {
        jobId,
        teamId,
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "head",
      },
      {
        queue: { enqueue: async () => undefined },
        createTraceId: () => "trace-preview",
      }
    );
    if (!preview.success) {
      throw new Error(preview.error.message);
    }
    await prisma.workflowNode.update({
      where: { id: preview.data.node.id },
      data: {
        status: "waiting_approval",
        requiresApproval: true,
        output: {
          videoArtifactId: "preview-artifact-1",
        },
      },
    });

    const result = await retryAvatarRenderPreview(
      {
        jobId,
        teamId,
        avatarRenderRequestId: preview.data.avatarRenderRequest.id,
      },
      {
        queue: {
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-avatar-preview-retry",
      }
    );

    expect(result.success).toBe(true);
    await expect(
      prisma.workflowNode.findUniqueOrThrow({ where: { id: preview.data.node.id } })
    ).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(result.success && result.data.avatarRenderRequest).toMatchObject({
      jobId,
      avatarId,
      audioArtifactId,
      mode: "preview",
      crop: "head",
      aspectRatio: "9:16",
      provider: "mock",
    });
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "avatar_render",
      status: "queued",
      version: 2,
      input: {
        mode: "preview",
        renderOptions: {
          crop: "head",
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
        },
      },
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "avatar_render",
        version: 2,
        traceId: "trace-avatar-preview-retry",
      },
    ]);
  });

  it("creates an hd avatar render request only from an approved preview", async () => {
    const enqueued: unknown[] = [];
    const preview = await createPreviewAvatarRenderTask(
      {
        jobId,
        teamId,
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      },
      {
        queue: { enqueue: async () => undefined },
        createTraceId: () => "trace-preview",
      }
    );
    if (!preview.success) {
      throw new Error(preview.error.message);
    }
    await prisma.workflowNode.update({
      where: { id: preview.data.node.id },
      data: {
        status: "approved",
        requiresApproval: true,
        approvedByUserId: userId,
        approvedAt: new Date("2026-06-24T00:00:00.000Z"),
        output: {
          videoArtifactId: "preview-artifact-1",
        },
      },
    });

    const result = await createHdAvatarRenderTask(
      {
        jobId,
        teamId,
        previewAvatarRenderRequestId: preview.data.avatarRenderRequest.id,
      },
      {
        queue: {
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-avatar-hd-api",
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.previewNode).toMatchObject({
      id: preview.data.node.id,
      status: "approved",
      approvedByUserId: userId,
    });
    expect(result.success && result.data.avatarRenderRequest).toMatchObject({
      jobId,
      avatarId,
      audioArtifactId,
      mode: "hd",
      crop: "half_body",
      aspectRatio: "9:16",
      provider: "mock",
    });
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "avatar_render",
      status: "queued",
      version: 2,
      input: {
        mode: "hd",
        avatarId,
        audioArtifactId,
        sourceImageUrl: "s3://voflow/team/avatar-source.png",
        audioUrl: "s3://voflow/team/jobs/job-1/tts/audio.wav",
        renderOptions: {
          crop: "half_body",
          resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd,
        },
      },
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "avatar_render",
        version: 2,
        traceId: "trace-avatar-hd-api",
      },
    ]);
  });

  it("rejects hd render creation before the preview is approved", async () => {
    const preview = await createPreviewAvatarRenderTask(
      {
        jobId,
        teamId,
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      },
      {
        queue: { enqueue: async () => undefined },
        createTraceId: () => "trace-preview",
      }
    );
    if (!preview.success) {
      throw new Error(preview.error.message);
    }
    await prisma.workflowNode.update({
      where: { id: preview.data.node.id },
      data: {
        status: "waiting_approval",
        requiresApproval: true,
      },
    });

    const result = await createHdAvatarRenderTask({
      jobId,
      teamId,
      previewAvatarRenderRequestId: preview.data.avatarRenderRequest.id,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "AVATAR_RENDER_PREVIEW_NOT_APPROVED",
        message: "预览渲染尚未确认",
      },
    });
  });
});
