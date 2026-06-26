import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isEncryptedChannelToken } from "@/lib/publish/token";
import { GET } from "@/app/api/channel-accounts/[platform]/authorize/route";
import { POST } from "@/app/api/channel-accounts/[platform]/mock-authorize/route";

describe("channel OAuth placeholder APIs", () => {
  let userId: string;
  let teamId: string;
  let previousTokenSecret: string | undefined;

  beforeEach(async () => {
    previousTokenSecret = process.env.CHANNEL_TOKEN_ENCRYPTION_SECRET;
    process.env.CHANNEL_TOKEN_ENCRYPTION_SECRET = "test-channel-oauth-secret";

    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `channel_oauth_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Channel OAuth API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Channel OAuth API Team",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });
    teamId = team.id;
  });

  afterEach(async () => {
    await prisma.channelAccount.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    if (previousTokenSecret === undefined) {
      delete process.env.CHANNEL_TOKEN_ENCRYPTION_SECRET;
    } else {
      process.env.CHANNEL_TOKEN_ENCRYPTION_SECRET = previousTokenSecret;
    }
  });

  it("requires authentication for authorization entry", async () => {
    const response = await GET(createRequest(), {
      params: Promise.resolve({ platform: "douyin" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns a mock authorization entry for a platform", async () => {
    const response = await GET(await createAuthenticatedRequest(), {
      params: Promise.resolve({ platform: "douyin" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        authorization: {
          platform: "douyin",
          platformLabel: "抖音",
          provider: "mock",
          status: "mock_available",
          authorizationUrl: "/api/channel-accounts/douyin/mock-authorize",
          reauthorizeUrl: "/api/channel-accounts/douyin/mock-authorize",
        },
      },
    });
  });

  it("rejects unsupported authorization platforms", async () => {
    const response = await GET(await createAuthenticatedRequest(), {
      params: Promise.resolve({ platform: "unknown" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "PUBLISH_PLATFORM_UNSUPPORTED",
      message: "不支持该发布平台",
    });
  });

  it("creates a mock connected channel account with encrypted token", async () => {
    const response = await POST(
      await createAuthenticatedRequest({
        accountName: "抖音测试号",
        expiresInDays: 10,
      }),
      {
        params: Promise.resolve({ platform: "douyin" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      message: "渠道账号已授权",
      data: {
        account: {
          platform: "douyin",
          status: "connected",
          accountName: "抖音测试号",
          requiresAuth: false,
          expiresAt: expect.any(String),
        },
        authorization: {
          provider: "mock",
          isMock: true,
        },
      },
    });

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "douyin",
      },
    });
    expect(saved.status).toBe("connected");
    expect(saved.accountName).toBe("抖音测试号");
    expect(saved.encryptedToken).toBeTruthy();
    expect(saved.encryptedToken).not.toContain("mock-channel-token");
    expect(isEncryptedChannelToken(saved.encryptedToken)).toBe(true);
  });

  it("reauthorizes an expired account by overwriting it with a connected mock account", async () => {
    await prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: "kuaishou",
        accountName: "过期账号",
        encryptedToken: "voflow_channel_token_v1.expired.token.payload",
        status: "expired",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const response = await POST(
      await createAuthenticatedRequest({
        accountName: "快手重新授权号",
        expiresInDays: 30,
      }),
      {
        params: Promise.resolve({ platform: "kuaishou" }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        account: {
          platform: "kuaishou",
          status: "connected",
          accountName: "快手重新授权号",
          requiresAuth: false,
        },
      },
    });

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "kuaishou",
      },
    });
    expect(saved.status).toBe("connected");
    expect(saved.accountName).toBe("快手重新授权号");
    expect(saved.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  async function createAuthenticatedRequest(body?: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "channel-oauth-api@example.com",
      name: "Channel OAuth API User",
      teamId,
    });
    const request = createRequest(body);
    request.cookies.set("session", token);

    return request;
  }
});

function createRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/channel-accounts/douyin/authorize", {
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined
        ? undefined
        : {
            "Content-Type": "application/json",
          },
  });
}
