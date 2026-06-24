import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { AVATAR_RENDER_DEFAULT_RESOLUTIONS } from "@/lib/avatar-render/constants";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST as createAvatarRenderPreview } from "@/app/api/video-jobs/[jobId]/avatar-render/preview/route";
import { POST as confirmAvatarRenderPreview } from "@/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/confirm/route";
import { POST as retryAvatarRenderPreviewRoute } from "@/app/api/video-jobs/[jobId]/avatar-render/preview/[avatarRenderRequestId]/retry/route";

const PASSED_AVATAR_QUALITY = {
  passed: true,
  faceCount: 1,
  confidence: 0.98,
};

describe("Avatar render preview API", () => {
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
        email: `avatar_render_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar Render API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar Render API Team",
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
        name: "Avatar Render API Project",
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

  it("creates a queued preview avatar render request", async () => {
    const response = await createAvatarRenderPreview(
      await createRequest({
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        avatarRenderRequest: {
          jobId,
          avatarId,
          audioArtifactId,
          mode: "preview",
          crop: "half_body",
          aspectRatio: "9:16",
          provider: "mock",
        },
        node: {
          jobId,
          nodeType: "avatar_render",
          status: "queued",
          input: {
            mode: "preview",
            renderOptions: {
              crop: "half_body",
              resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
            },
          },
        },
      },
    });

    const persistedRequest = await prisma.avatarRenderRequest.findFirst({
      where: { jobId, mode: "preview" },
      include: { node: true },
    });
    expect(persistedRequest).toMatchObject({
      avatarId,
      audioArtifactId,
      crop: "half_body",
      provider: "mock",
      node: {
        status: "queued",
        nodeType: "avatar_render",
      },
    });
  });

  it("returns validation error when preview crop is missing", async () => {
    const response = await createAvatarRenderPreview(
      await createRequest({
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("returns avatar render input errors from the shared validation service", async () => {
    await prisma.avatar.update({
      where: { id: avatarId },
      data: { status: "draft" },
    });

    const response = await createAvatarRenderPreview(
      await createRequest({
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "AVATAR_NOT_READY",
      message: "数字人不可用",
    });
  });

  it("confirms a preview render and creates an hd avatar render request", async () => {
    const previewResponse = await createAvatarRenderPreview(
      await createRequest({
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "half_body",
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );
    const previewBody = await previewResponse.json();
    const avatarRenderRequestId = previewBody.data.avatarRenderRequest.id as string;
    const previewNodeId = previewBody.data.node.id as string;
    await prisma.workflowNode.update({
      where: { id: previewNodeId },
      data: {
        status: "waiting_approval",
        requiresApproval: true,
        output: {
          videoArtifactId: "preview-artifact-1",
        },
      },
    });

    const response = await confirmAvatarRenderPreview(
      await createActionRequest(
        `/api/video-jobs/${jobId}/avatar-render/preview/${avatarRenderRequestId}/confirm`
      ),
      {
        params: Promise.resolve({ jobId, avatarRenderRequestId }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        previewNode: {
          id: previewNodeId,
          status: "approved",
          approvedByUserId: userId,
        },
        avatarRenderRequest: {
          mode: "hd",
          avatarId,
          audioArtifactId,
          crop: "half_body",
          aspectRatio: "9:16",
        },
        node: {
          nodeType: "avatar_render",
          status: "queued",
          input: {
            mode: "hd",
            renderOptions: {
              resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd,
            },
          },
        },
      },
    });
  });

  it("retries a preview render by cancelling the current preview and creating a queued preview", async () => {
    const previewResponse = await createAvatarRenderPreview(
      await createRequest({
        avatarId,
        audioArtifactId,
        aspectRatio: "9:16",
        crop: "head",
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );
    const previewBody = await previewResponse.json();
    const avatarRenderRequestId = previewBody.data.avatarRenderRequest.id as string;
    const previewNodeId = previewBody.data.node.id as string;
    await prisma.workflowNode.update({
      where: { id: previewNodeId },
      data: {
        status: "waiting_approval",
        requiresApproval: true,
      },
    });

    const response = await retryAvatarRenderPreviewRoute(
      await createActionRequest(
        `/api/video-jobs/${jobId}/avatar-render/preview/${avatarRenderRequestId}/retry`
      ),
      {
        params: Promise.resolve({ jobId, avatarRenderRequestId }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        cancelledPreviewNode: {
          id: previewNodeId,
          status: "cancelled",
        },
        avatarRenderRequest: {
          mode: "preview",
          avatarId,
          audioArtifactId,
          crop: "head",
          aspectRatio: "9:16",
        },
        node: {
          nodeType: "avatar_render",
          status: "queued",
          input: {
            mode: "preview",
            renderOptions: {
              resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
            },
          },
        },
      },
    });
  });

  async function createRequest(body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "avatar-render-api@example.com",
      name: "Avatar Render API User",
    });

    return new NextRequest(
      `http://localhost:3000/api/video-jobs/${jobId}/avatar-render/preview`,
      {
        method: "POST",
        headers: {
          cookie: `session=${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  }

  async function createActionRequest(path: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "avatar-render-api@example.com",
      name: "Avatar Render API User",
    });

    return new NextRequest(`http://localhost:3000${path}`, {
      method: "POST",
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
