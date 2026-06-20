import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/projects/[projectId]/scripts/from-media/route";

describe("POST /api/projects/[projectId]/scripts/from-media", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;
  let audioAssetId: string;
  let videoAssetId: string;
  let imageAssetId: string;
  let pendingAudioAssetId: string;
  let longAudioAssetId: string;
  let otherAssetId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_from_media_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script From Media User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script From Media Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Script From Media Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
      },
    });

    const project = await createProject("Script From Media Project", teamId);
    projectId = project.id;
    const otherProject = await createProject("Other Script From Media Project", otherTeamId);
    otherProjectId = otherProject.id;

    audioAssetId = (await createAsset("audio", "sample.wav", teamId, { durationMs: 120_000 })).id;
    videoAssetId = (await createAsset("video", "sample.mp4", teamId, { durationMs: 90_000 })).id;
    imageAssetId = (await createAsset("image", "sample.png", teamId, { width: 1080 })).id;
    pendingAudioAssetId = (await createAsset("audio", "pending.wav", teamId, { durationMs: 60_000 }, "pending")).id;
    longAudioAssetId = (await createAsset("audio", "long.wav", teamId, { durationMs: 180_001 })).id;
    otherAssetId = (await createAsset("audio", "other.wav", otherTeamId, { durationMs: 60_000 })).id;
  });

  afterEach(async () => {
    const jobIds = (
      await prisma.videoJob.findMany({
        where: { projectId: { in: [projectId, otherProjectId] } },
        select: { id: true },
      })
    ).map((job) => job.id);

    await prisma.workflowNode.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.videoJob.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.asset.deleteMany({
      where: {
        id: {
          in: [
            audioAssetId,
            videoAssetId,
            imageAssetId,
            pendingAudioAssetId,
            longAudioAssetId,
            otherAssetId,
          ],
        },
      },
    });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [
          { teamId },
          { teamId: otherTeamId },
          { userId },
        ],
      },
    });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await POST(createJsonRequest(projectId, { assetId: audioAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 for assets outside the current team", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: otherAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "素材不存在",
    });
  });

  it("rejects unsupported asset types", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: imageAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ASR_UNSUPPORTED_ASSET_TYPE",
      message: "仅支持音频或视频素材转写",
    });
  });

  it("rejects assets that are not approved for use", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: pendingAudioAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ASSET_LICENSE_NOT_APPROVED",
      message: "素材授权未确认",
    });
  });

  it("rejects media longer than three minutes", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: longAudioAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ASR_DURATION_LIMIT_EXCEEDED",
      message: "音视频时长超过 3 分钟",
    });
  });

  it("creates a queued ASR workflow node input for approved audio", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: audioAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.message).toBe("转写任务已创建");
    expect(body.data.job).toMatchObject({
      projectId,
      teamId,
      ownerId: userId,
      status: "queued",
      currentNode: "script_prepare",
    });
    expect(body.data.node).toMatchObject({
      jobId: body.data.job.id,
      nodeType: "script_prepare",
      status: "queued",
      version: 1,
      input: {
        sourceType: "media_asr",
        assetId: audioAssetId,
        assetType: "audio",
        storageUrl: "voflow/team/assets/sample.wav",
        durationMs: 120_000,
      },
    });

    const savedNode = await prisma.workflowNode.findUnique({
      where: { id: body.data.node.id },
    });
    expect(savedNode?.input).toMatchObject({
      sourceType: "media_asr",
      assetId: audioAssetId,
      assetType: "audio",
      durationMs: 120_000,
    });
  });

  it("accepts approved video assets", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { assetId: videoAssetId }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.node.input).toMatchObject({
      assetId: videoAssetId,
      assetType: "video",
      durationMs: 90_000,
    });
  });

  async function createProject(name: string, projectTeamId: string) {
    return prisma.project.create({
      data: {
        teamId: projectTeamId,
        ownerId: userId,
        name,
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
  }

  async function createAsset(
    type: "audio" | "video" | "image",
    name: string,
    assetTeamId: string,
    metadata: Prisma.InputJsonObject,
    licenseStatus: "pending" | "approved" = "approved"
  ) {
    return prisma.asset.create({
      data: {
        teamId: assetTeamId,
        ownerId: userId,
        type,
        name,
        storageUrl: `voflow/team/assets/${name}`,
        mimeType: type === "audio" ? "audio/wav" : type === "video" ? "video/mp4" : "image/png",
        sizeBytes: BigInt(1024),
        metadata,
        licenseStatus,
      },
    });
  }

  function createJsonRequest(targetProjectId: string, body: unknown, cookie?: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/projects/${targetProjectId}/scripts/from-media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async function createAuthenticatedRequest(targetProjectId: string, body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "script-from-media@example.com",
      name: "Script From Media User",
    });

    return createJsonRequest(targetProjectId, body, `session=${token}`);
  }
});
