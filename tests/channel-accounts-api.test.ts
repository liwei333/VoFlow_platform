import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/channel-accounts/route";

describe("GET /api/channel-accounts", () => {
  let userId: string;
  let teamId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `channel_accounts_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Channel Accounts API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Channel Accounts API Team",
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

    await prisma.channelAccount.createMany({
      data: [
        {
          teamId,
          userId,
          platform: "douyin",
          accountName: "抖音运营号",
          encryptedToken: "voflow_channel_token_v1.fake",
          status: "connected",
          expiresAt: new Date(Date.now() + 86_400_000),
        },
        {
          teamId,
          userId,
          platform: "kuaishou",
          accountName: "快手运营号",
          encryptedToken: "voflow_channel_token_v1.expired",
          status: "connected",
          expiresAt: new Date(Date.now() - 60_000),
        },
        {
          teamId,
          userId,
          platform: "bilibili",
          accountName: "B站运营号",
          encryptedToken: null,
          status: "revoked",
          expiresAt: null,
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.channelAccount.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await GET(new NextRequest("http://localhost/api/channel-accounts"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns one display account for every publish platform", async () => {
    const response = await GET(await createAuthenticatedRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.accounts).toHaveLength(7);
    expect(body.data.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "douyin",
          platformLabel: "抖音",
          status: "connected",
          statusLabel: "已授权",
          accountName: "抖音运营号",
          expiresAt: expect.any(String),
          requiresAuth: false,
        }),
        expect.objectContaining({
          platform: "kuaishou",
          platformLabel: "快手",
          status: "expired",
          statusLabel: "授权已过期",
          accountName: "快手运营号",
          expiresAt: expect.any(String),
          requiresAuth: true,
        }),
        expect.objectContaining({
          platform: "xiaohongshu",
          platformLabel: "小红书",
          status: "not_connected",
          statusLabel: "未授权",
          accountName: null,
          expiresAt: null,
          requiresAuth: true,
        }),
        expect.objectContaining({
          platform: "bilibili",
          status: "not_connected",
          statusLabel: "未授权",
          requiresAuth: true,
        }),
      ])
    );
    expect(JSON.stringify(body)).not.toContain("encryptedToken");
    expect(JSON.stringify(body)).not.toContain("voflow_channel_token_v1");
  });

  async function createAuthenticatedRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "channel-accounts-api@example.com",
      name: "Channel Accounts API User",
      teamId,
    });
    const request = new NextRequest("http://localhost/api/channel-accounts");
    request.cookies.set("session", token);

    return request;
  }
});
