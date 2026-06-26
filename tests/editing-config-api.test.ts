import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  GET,
  PUT,
} from "@/app/api/video-jobs/[jobId]/editing-config/route";

describe("Editing config APIs", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let createdAssetIds: string[];

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    createdAssetIds = [];
    const user = await prisma.user.create({
      data: {
        email: `editing_config_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Editing Config API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Editing Config Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Editing Config Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.createMany({
      data: [
        {
          teamId,
          userId,
          role: "member",
        },
        {
          teamId: otherTeamId,
          userId,
          role: "member",
        },
      ],
    });

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Editing Config Project",
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
        currentNode: "editing_preview",
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "editing_preview",
        status: "succeeded",
        version: 1,
      },
    });
    nodeId = node.id;
  });

  afterEach(async () => {
    await prisma.editingConfig.deleteMany({ where: { jobId } });
    await prisma.assetConsent.deleteMany({
      where: {
        assetId: {
          in: createdAssetIds,
        },
      },
    });
    await prisma.asset.deleteMany({
      where: {
        id: {
          in: createdAssetIds,
        },
      },
    });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [{ teamId }, { teamId: otherTeamId }, { userId }],
      },
    });
    await prisma.team.deleteMany({
      where: {
        id: {
          in: [teamId, otherTeamId],
        },
      },
    });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns default editing config when the job has no saved config", async () => {
    const response = await GET(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          id: null,
          jobId,
          isDefault: true,
          subtitleEnabled: true,
          keywordHighlightEnabled: false,
          bgmDuckingEnabled: true,
          pipEnabled: false,
          pipAssetId: null,
          pipPosition: "top_right",
          pipSize: 25,
          backgroundAssetId: null,
          voiceVolume: 100,
          bgmVolume: 35,
          transitionStrength: 50,
          configJson: null,
          previewArtifactId: null,
          previewArtifact: null,
          createdAt: null,
          updatedAt: null,
        },
      },
    });
  });

  it("returns saved editing config with preview artifact details", async () => {
    const previewArtifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId,
        type: "editing_preview",
        storageUrl: "voflow/team/jobs/job-1/editing/preview.mp4",
        metadata: {
          durationMs: 1200,
        },
      },
    });

    const savedConfig = await prisma.editingConfig.create({
      data: {
        jobId,
        subtitleEnabled: false,
        keywordHighlightEnabled: true,
        bgmDuckingEnabled: false,
        pipEnabled: true,
        pipPosition: "bottom_left",
        pipSize: 40,
        voiceVolume: 82,
        bgmVolume: 18,
        transitionStrength: 65,
        configJson: {
          subtitleStyle: "bold_keyword",
        },
        previewArtifactId: previewArtifact.id,
      },
    });

    const response = await GET(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          id: savedConfig.id,
          jobId,
          isDefault: false,
          subtitleEnabled: false,
          keywordHighlightEnabled: true,
          bgmDuckingEnabled: false,
          pipEnabled: true,
          pipPosition: "bottom_left",
          pipSize: 40,
          voiceVolume: 82,
          bgmVolume: 18,
          transitionStrength: 65,
          configJson: {
            subtitleStyle: "bold_keyword",
          },
          previewArtifactId: previewArtifact.id,
          previewArtifact: {
            id: previewArtifact.id,
            type: "editing_preview",
            storageUrl: "voflow/team/jobs/job-1/editing/preview.mp4",
            metadata: {
              durationMs: 1200,
            },
            createdAt: expect.any(String),
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });
  });

  it("returns 404 when the job is outside the current team", async () => {
    const response = await GET(await createAuthenticatedRequest(otherTeamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("returns 404 when the job does not exist", async () => {
    const response = await GET(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ jobId: "missing-job" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("requires authentication when saving editing config", async () => {
    const response = await PUT(
      createJsonRequest({
        subtitleEnabled: false,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("saves editing config and returns the persisted config", async () => {
    const pipAsset = await createAsset({
      type: "image",
      mimeType: "image/png",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        subtitleEnabled: false,
        keywordHighlightEnabled: true,
        bgmDuckingEnabled: false,
        pipEnabled: true,
        pipAssetId: pipAsset.id,
        pipPosition: "bottom_right",
        pipSize: 42,
        voiceVolume: 88,
        bgmVolume: 16,
        transitionStrength: 64,
        configJson: {
          subtitleStyle: "bold_keyword",
        },
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          id: expect.any(String),
          jobId,
          isDefault: false,
          subtitleEnabled: false,
          keywordHighlightEnabled: true,
          bgmDuckingEnabled: false,
          pipEnabled: true,
          pipAssetId: pipAsset.id,
          pipPosition: "bottom_right",
          pipSize: 42,
          voiceVolume: 88,
          bgmVolume: 16,
          transitionStrength: 64,
          configJson: {
            subtitleStyle: "bold_keyword",
          },
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });

    const getResponse = await GET(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ jobId }),
    });
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          isDefault: false,
          subtitleEnabled: false,
          keywordHighlightEnabled: true,
          pipEnabled: true,
          pipAssetId: pipAsset.id,
          pipPosition: "bottom_right",
          pipSize: 42,
          voiceVolume: 88,
          bgmVolume: 16,
          transitionStrength: 64,
        },
      },
    });
  });

  it("updates an existing editing config", async () => {
    await prisma.editingConfig.create({
      data: {
        jobId,
        subtitleEnabled: true,
        keywordHighlightEnabled: false,
        pipEnabled: false,
        pipPosition: "top_left",
        pipSize: 20,
        voiceVolume: 100,
        bgmVolume: 35,
        transitionStrength: 50,
      },
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        subtitleEnabled: true,
        keywordHighlightEnabled: true,
        bgmDuckingEnabled: true,
        pipEnabled: false,
        pipPosition: "top_right",
        pipSize: 30,
        voiceVolume: 75,
        bgmVolume: 25,
        transitionStrength: 12,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          jobId,
          isDefault: false,
          keywordHighlightEnabled: true,
          pipPosition: "top_right",
          pipSize: 30,
          voiceVolume: 75,
          bgmVolume: 25,
          transitionStrength: 12,
        },
      },
    });
  });

  it("rejects out-of-range editing config values", async () => {
    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipPosition: "center",
        pipSize: 9,
        voiceVolume: 101,
        bgmVolume: -1,
        transitionStrength: 101,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["pipPosition"] }),
        expect.objectContaining({ path: ["pipSize"] }),
        expect.objectContaining({ path: ["voiceVolume"] }),
        expect.objectContaining({ path: ["bgmVolume"] }),
        expect.objectContaining({ path: ["transitionStrength"] }),
      ])
    );
  });

  it("returns 404 when saving config for a job outside the current team", async () => {
    const response = await PUT(
      await createAuthenticatedJsonRequest(otherTeamId, {
        subtitleEnabled: false,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("rejects enabled pip when pip asset is missing", async () => {
    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipEnabled: true,
        pipPosition: "top_right",
        pipSize: 30,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PIP_ASSET_LICENSE_NOT_APPROVED",
      message: "画中画素材未授权",
    });
  });

  it("rejects unapproved pip assets", async () => {
    const pipAsset = await createAsset({
      type: "image",
      mimeType: "image/png",
      licenseStatus: "pending",
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipEnabled: true,
        pipAssetId: pipAsset.id,
        pipPosition: "top_right",
        pipSize: 30,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PIP_ASSET_LICENSE_NOT_APPROVED",
      message: "画中画素材未授权",
    });
  });

  it("rejects pip assets outside the current team", async () => {
    const pipAsset = await createAsset({
      teamId: otherTeamId,
      type: "video",
      mimeType: "video/mp4",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipEnabled: true,
        pipAssetId: pipAsset.id,
        pipPosition: "bottom_left",
        pipSize: 30,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PIP_ASSET_LICENSE_NOT_APPROVED",
      message: "画中画素材未授权",
    });
  });

  it("rejects non image or video pip assets", async () => {
    const pipAsset = await createAsset({
      type: "audio",
      mimeType: "audio/mpeg",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipEnabled: true,
        pipAssetId: pipAsset.id,
        pipPosition: "bottom_left",
        pipSize: 30,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "PIP_ASSET_TYPE_UNSUPPORTED",
      message: "画中画素材仅支持图片或视频",
    });
  });

  it("saves enabled pip with an approved image or video asset", async () => {
    const pipAsset = await createAsset({
      type: "video",
      mimeType: "video/mp4",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        pipEnabled: true,
        pipAssetId: pipAsset.id,
        pipPosition: "bottom_right",
        pipSize: 36,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          pipEnabled: true,
          pipAssetId: pipAsset.id,
          pipPosition: "bottom_right",
          pipSize: 36,
        },
      },
    });
  });

  it("rejects unapproved background assets", async () => {
    const backgroundAsset = await createAsset({
      type: "image",
      mimeType: "image/png",
      licenseStatus: "pending",
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        backgroundAssetId: backgroundAsset.id,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "BACKGROUND_ASSET_LICENSE_NOT_APPROVED",
      message: "背景素材未授权",
    });
  });

  it("rejects background assets outside the current team", async () => {
    const backgroundAsset = await createAsset({
      teamId: otherTeamId,
      type: "video",
      mimeType: "video/mp4",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        backgroundAssetId: backgroundAsset.id,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "BACKGROUND_ASSET_LICENSE_NOT_APPROVED",
      message: "背景素材未授权",
    });
  });

  it("rejects non image or video background assets", async () => {
    const backgroundAsset = await createAsset({
      type: "audio",
      mimeType: "audio/mpeg",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        backgroundAssetId: backgroundAsset.id,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "BACKGROUND_ASSET_TYPE_UNSUPPORTED",
      message: "背景素材仅支持图片或视频",
    });
  });

  it("saves a background image or video when the asset is approved", async () => {
    const backgroundAsset = await createAsset({
      type: "video",
      mimeType: "video/mp4",
      licenseStatus: "approved",
      withConsent: true,
    });

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        backgroundAssetId: backgroundAsset.id,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          backgroundAssetId: backgroundAsset.id,
        },
      },
    });
  });

  it("generates keyword highlight config from the approved script when enabled", async () => {
    await createApprovedScript(
      "智能补光镜让肤色更自然，直播画面更清晰。立即下单，今天送柔光支架。"
    );

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        keywordHighlightEnabled: true,
        configJson: {
          subtitleStyle: "default",
        },
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          keywordHighlightEnabled: true,
          configJson: {
            subtitleStyle: "default",
            keywordHighlight: {
              enabled: true,
              keywords: ["智能补光镜", "肤色更自然", "直播画面", "立即下单", "柔光支架"],
              assStyle: {
                styleName: "KeywordHighlight",
                primaryColor: "&H0000D7FF",
                outlineColor: "&H00000000",
                bold: true,
              },
            },
          },
        },
      },
    });
  });

  it("writes disabled keyword highlight config when keyword highlight is off", async () => {
    await createApprovedScript("智能补光镜让直播画面更清晰。");

    const response = await PUT(
      await createAuthenticatedJsonRequest(teamId, {
        keywordHighlightEnabled: false,
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        config: {
          keywordHighlightEnabled: false,
          configJson: {
            keywordHighlight: {
              enabled: false,
              keywords: [],
              assStyle: {
                styleName: "KeywordHighlight",
                primaryColor: "&H0000D7FF",
                outlineColor: "&H00000000",
                bold: true,
              },
            },
          },
        },
      },
    });
  });

  function createRequest(cookie?: string): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/video-jobs/${jobId}/editing-config`,
      {
        headers: cookie ? { cookie } : undefined,
      }
    );
  }

  async function createAuthenticatedRequest(requestTeamId: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId: requestTeamId,
      email: "editing-config-api@example.com",
      name: "Editing Config API User",
    });

    return createRequest(`session=${token}`);
  }

  function createJsonRequest(body: unknown, cookie?: string): NextRequest {
    return new NextRequest(
      `http://localhost:3000/api/video-jobs/${jobId}/editing-config`,
      {
        method: "PUT",
        headers: {
          ...(cookie ? { cookie } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
  }

  async function createAuthenticatedJsonRequest(
    requestTeamId: string,
    body: unknown
  ): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId: requestTeamId,
      email: "editing-config-api@example.com",
      name: "Editing Config API User",
    });

    return createJsonRequest(body, `session=${token}`);
  }

  async function createAsset(options: {
    teamId?: string;
    type: "image" | "video" | "audio";
    mimeType: string;
    licenseStatus: "pending" | "approved" | "rejected" | "expired";
    withConsent?: boolean;
  }) {
    const targetTeamId = options.teamId ?? teamId;
    const asset = await prisma.asset.create({
      data: {
        teamId: targetTeamId,
        ownerId: userId,
        type: options.type,
        name: `pip-${options.type}`,
        storageUrl: `voflow/${targetTeamId}/assets/pip-${options.type}`,
        mimeType: options.mimeType,
        sizeBytes: 1024,
        licenseStatus: options.licenseStatus,
      },
    });
    createdAssetIds.push(asset.id);

    if (options.withConsent) {
      await prisma.assetConsent.create({
        data: {
          assetId: asset.id,
          teamId: targetTeamId,
          userId,
          consentType: "asset_license",
          consentText: "同意用于视频生成",
          usageScope: ["video_generation"],
        },
      });
    }

    return asset;
  }

  async function createApprovedScript(content: string) {
    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "pasted",
        content,
        status: "approved",
      },
    });

    await prisma.scriptCandidate.create({
      data: {
        scriptId: script.id,
        content,
        status: "approved",
      },
    });

    return script;
  }
});
