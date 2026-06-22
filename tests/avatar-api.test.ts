import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST as createAvatar, GET as listAvatars } from "@/app/api/avatars/route";
import { DELETE as deleteAvatar } from "@/app/api/avatars/[avatarId]/route";
import { POST as confirmAvatarConsent } from "@/app/api/avatars/[avatarId]/consents/route";
import { POST as setDefaultAvatar } from "@/app/api/avatars/[avatarId]/default/route";

const PASSED_QUALITY_REPORT = {
  passed: true,
  faceCount: 1,
  resolution: { width: 1080, height: 1440 },
  faceBoxRatio: 0.42,
  confidence: 0.98,
  yaw: 0,
  pitch: 0,
  roll: 0,
  blurScore: 160,
  occlusion: "none",
  exposure: "normal",
  reasons: [],
};

const FAILED_QUALITY_REPORT = {
  ...PASSED_QUALITY_REPORT,
  passed: false,
  reasons: [{ code: "AVATAR_PHOTO_BLURRY", message: "照片清晰度不足" }],
};

describe("Avatar APIs", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let sourceAssetId: string;
  let failedSourceAssetId: string;
  let otherTeamAssetId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `avatar_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Avatar API Team",
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

    sourceAssetId = await createAvatarSourceAsset(teamId, PASSED_QUALITY_REPORT, "usable");
    failedSourceAssetId = await createAvatarSourceAsset(teamId, FAILED_QUALITY_REPORT, "failed");
    otherTeamAssetId = await createAvatarSourceAsset(otherTeamId, PASSED_QUALITY_REPORT, "other");
  });

  afterEach(async () => {
    await prisma.avatarConsent.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.avatar.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.auditLog.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.asset.deleteMany({ where: { teamId: { in: [teamId, otherTeamId] } } });
    await prisma.teamMember.deleteMany({ where: { userId } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("rejects avatar creation when portrait consent is missing", async () => {
    const response = await createAvatar(await createAuthenticatedJsonRequest({
      sourceAssetId,
      name: "未授权数字人",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "AVATAR_CONSENT_REQUIRED",
    });
  });

  it("rejects source photos that failed quality checks", async () => {
    const response = await createAvatar(await createAuthenticatedJsonRequest({
      sourceAssetId: failedSourceAssetId,
      name: "失败照片数字人",
      consentText: "我确认授权",
      usageScope: ["avatar_generation", "video_generation"],
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "AVATAR_PHOTO_QUALITY_NOT_PASSED",
    });
  });

  it("creates a ready avatar with portrait consent for the current team", async () => {
    const response = await createAvatar(await createAuthenticatedJsonRequest({
      sourceAssetId,
      name: "本人数字人",
      consentText: "我确认拥有本人肖像授权并同意用于数字人生成和视频生成",
      usageScope: ["avatar_generation", "video_generation"],
      deviceJson: { userAgent: "vitest" },
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        avatar: {
          name: "本人数字人",
          status: "ready",
          licenseStatus: "approved",
          sourceAsset: {
            id: sourceAssetId,
            type: "avatar_source",
          },
        },
      },
    });

    const persistedConsent = await prisma.avatarConsent.findFirst({
      where: { avatarId: body.data.avatar.id },
    });
    expect(persistedConsent).toMatchObject({
      teamId,
      userId,
      consentType: "portrait_license",
      usageScope: ["avatar_generation", "video_generation"],
    });
  });

  it("confirms portrait consent and makes a draft avatar selectable", async () => {
    const avatar = await createPersistedAvatar("draft", null);

    const response = await confirmAvatarConsent(
      await createAuthenticatedJsonRequest({
        consentText: "我确认拥有本人肖像授权并同意用于数字人生成和视频生成",
        usageScope: ["avatar_generation", "video_generation"],
        deviceJson: { userAgent: "vitest" },
      }),
      { params: Promise.resolve({ avatarId: avatar.id }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        avatar: {
          id: avatar.id,
          status: "ready",
          licenseStatus: "approved",
        },
      },
    });

    const persistedConsent = await prisma.avatarConsent.findFirst({
      where: { avatarId: avatar.id },
    });
    expect(persistedConsent).toMatchObject({
      teamId,
      userId,
      consentType: "portrait_license",
      usageScope: ["avatar_generation", "video_generation"],
    });

    const listResponse = await listAvatars(await createAuthenticatedGetRequest());
    const listBody = await listResponse.json();
    expect(listBody.data.avatars.map((item: { id: string }) => item.id)).toEqual([avatar.id]);
  });

  it("lists only ready non-deleted avatars from the current team", async () => {
    const readyAvatar = await createPersistedAvatar("ready", null);
    await createPersistedAvatar("draft", null);
    await createPersistedAvatar("ready", new Date());
    await prisma.avatar.create({
      data: {
        teamId: otherTeamId,
        ownerId: userId,
        name: "Other Team Avatar",
        sourceAssetId: otherTeamAssetId,
        status: "ready",
        licenseStatus: "approved",
        qualityReport: PASSED_QUALITY_REPORT,
      },
    });

    const response = await listAvatars(await createAuthenticatedGetRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.avatars.map((avatar: { id: string }) => avatar.id)).toEqual([readyAvatar.id]);
    expect(body.data.avatars[0]).toMatchObject({
      id: readyAvatar.id,
      previewUrl: null,
      isDefault: false,
      sourceAsset: {
        id: sourceAssetId,
      },
    });
    expect(body.data.avatars[0].sourceAsset.accessUrl).toEqual(expect.any(String));
  });

  it("returns generated avatar preview separately from the source image", async () => {
    const previewUrl = "https://cdn.example.com/avatar-preview.png";
    const readyAvatar = await createPersistedAvatar("ready", null, { previewUrl });

    const response = await listAvatars(await createAuthenticatedGetRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.avatars[0]).toMatchObject({
      id: readyAvatar.id,
      previewUrl,
      sourceAsset: {
        id: sourceAssetId,
      },
    });
    expect(body.data.avatars[0].sourceAsset.accessUrl).toEqual(expect.any(String));
    expect(body.data.avatars[0].sourceAsset.accessUrl).not.toBe(previewUrl);
  });

  it("sets a ready avatar as default and returns the default state in later lists", async () => {
    const avatar = await createPersistedAvatar("ready", null);

    const response = await setDefaultAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: avatar.id }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        avatar: {
          id: avatar.id,
          isDefault: true,
        },
      },
    });

    const listResponse = await listAvatars(await createAuthenticatedGetRequest());
    const listBody = await listResponse.json();
    expect(listBody.data.avatars).toHaveLength(1);
    expect(listBody.data.avatars[0]).toMatchObject({
      id: avatar.id,
      isDefault: true,
    });
  });

  it("clears the previous team default when setting a new default avatar", async () => {
    const firstAvatar = await createPersistedAvatar("ready", null);
    const secondAvatar = await createPersistedAvatar("ready", null);

    await setDefaultAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: firstAvatar.id }),
    });
    await setDefaultAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: secondAvatar.id }),
    });

    const persisted = await prisma.avatar.findMany({
      where: { id: { in: [firstAvatar.id, secondAvatar.id] } },
      select: { id: true, isDefault: true },
      orderBy: { id: "asc" },
    });

    expect(persisted).toEqual(
      expect.arrayContaining([
        { id: firstAvatar.id, isDefault: false },
        { id: secondAvatar.id, isDefault: true },
      ])
    );
  });

  it("does not allow setting another team's avatar as default", async () => {
    const otherTeamAvatar = await prisma.avatar.create({
      data: {
        teamId: otherTeamId,
        ownerId: userId,
        name: "Other Team Avatar",
        sourceAssetId: otherTeamAssetId,
        status: "ready",
        licenseStatus: "approved",
        qualityReport: PASSED_QUALITY_REPORT,
      },
    });

    const response = await setDefaultAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: otherTeamAvatar.id }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "AVATAR_NOT_FOUND",
    });

    const persisted = await prisma.avatar.findUnique({
      where: { id: otherTeamAvatar.id },
      select: { isDefault: true },
    });
    expect(persisted?.isDefault).toBe(false);
  });

  it("does not allow setting a deleted avatar as default", async () => {
    const deletedAvatar = await createPersistedAvatar("ready", new Date());

    const response = await setDefaultAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: deletedAvatar.id }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "AVATAR_NOT_FOUND",
    });

    const persisted = await prisma.avatar.findUnique({
      where: { id: deletedAvatar.id },
      select: { isDefault: true },
    });
    expect(persisted?.isDefault).toBe(false);
  });

  it("soft deletes an avatar and hides it from later lists", async () => {
    const avatar = await createPersistedAvatar("ready", null);

    const response = await deleteAvatar(await createAuthenticatedGetRequest(), {
      params: Promise.resolve({ avatarId: avatar.id }),
    });

    expect(response.status).toBe(200);
    const deleted = await prisma.avatar.findUnique({ where: { id: avatar.id } });
    expect(deleted).toMatchObject({
      status: "deleted",
      isDefault: false,
    });
    expect(deleted?.deletedAt).toBeInstanceOf(Date);

    const listResponse = await listAvatars(await createAuthenticatedGetRequest());
    const body = await listResponse.json();
    expect(body.data.avatars).toEqual([]);
  });

  async function createAvatarSourceAsset(team: string, qualityReport: Prisma.InputJsonValue, suffix: string) {
    const asset = await prisma.asset.create({
      data: {
        teamId: team,
        ownerId: userId,
        type: "avatar_source",
        name: `Avatar Source ${suffix}`,
        storageUrl: `voflow/${team}/assets/avatar-source-${suffix}/raw/avatar.png`,
        mimeType: "image/png",
        sizeBytes: BigInt(5000),
        metadata: {
          photoMetadata: {
            width: 1080,
            height: 1440,
            shortSide: 1080,
            resolutionPassed: true,
          },
          qualityReport,
        },
        licenseStatus: "pending",
      },
    });

    return asset.id;
  }

  async function createPersistedAvatar(
    status: "draft" | "ready",
    deletedAt: Date | null,
    options: { previewUrl?: string } = {}
  ) {
    return prisma.avatar.create({
      data: {
        teamId,
        ownerId: userId,
        name: `${status} Avatar ${deletedAt ? "Deleted" : "Active"}`,
        sourceAssetId,
        status,
        licenseStatus: status === "ready" ? "approved" : "pending",
        qualityReport: PASSED_QUALITY_REPORT,
        previewUrl: options.previewUrl,
        deletedAt,
      },
    });
  }

  async function createAuthenticatedJsonRequest(body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "avatar-api@example.com",
      name: "Avatar API User",
    });

    return new NextRequest("http://localhost:3000/api/avatars", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `session=${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function createAuthenticatedGetRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "avatar-api@example.com",
      name: "Avatar API User",
    });

    return new NextRequest("http://localhost:3000/api/avatars", {
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
