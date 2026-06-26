import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getChannelAuthorizationEntry } from "@/services/channelOAuthService";
import { GET as callbackGET } from "@/app/api/channel-accounts/[platform]/oauth/callback/route";
import { POST as refreshPOST } from "@/app/api/channel-accounts/[platform]/refresh/route";

const TEST_SECRET = "test-real-channel-oauth-api-secret";

const realOAuthEnv = {
  PUBLISH_REAL_ADAPTER_ENABLED: "true",
  PUBLISH_REAL_PROVIDER: "youtube",
  PUBLISH_ALLOW_MOCK_ADAPTER: "true",
  CHANNEL_TOKEN_ENCRYPTION_SECRET: TEST_SECRET,
  YOUTUBE_CLIENT_ID: "youtube-client-id",
  YOUTUBE_CLIENT_SECRET: "youtube-client-secret",
  YOUTUBE_REDIRECT_URI: "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
  YOUTUBE_API_BASE_URL: "https://www.googleapis.com/youtube/v3",
  YOUTUBE_OAUTH_AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
  YOUTUBE_OAUTH_TOKEN_URL: "https://oauth2.googleapis.com/token",
};

describe("real channel OAuth APIs", () => {
  let userId: string;
  let teamId: string;
  let previousEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    previousEnv = {};
    for (const [key, value] of Object.entries(realOAuthEnv)) {
      previousEnv[key] = process.env[key];
      process.env[key] = value;
    }

    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `real_channel_oauth_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Real Channel OAuth API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Real Channel OAuth API Team",
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
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
  });

  it("handles a real OAuth callback and stores the connected account", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "youtube-access-token",
            refresh_token: "youtube-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/youtube.upload",
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              {
                id: "youtube-channel-id",
                snippet: { title: "YouTube Channel" },
              },
            ],
          })
        )
    );
    const state = buildState();
    const request = await createAuthenticatedRequest(
      `http://localhost/api/channel-accounts/youtube_shorts/oauth/callback?code=callback-code&state=${encodeURIComponent(state)}`
    );

    const response = await callbackGET(request, {
      params: Promise.resolve({ platform: "youtube_shorts" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "渠道账号已授权",
      data: {
        account: {
          platform: "youtube_shorts",
          provider: "youtube",
          providerAccountId: "youtube-channel-id",
          accountName: "YouTube Channel",
        },
      },
    });
  });

  it("returns a stable error for invalid callback state", async () => {
    const response = await callbackGET(
      await createAuthenticatedRequest(
        "http://localhost/api/channel-accounts/youtube_shorts/oauth/callback?code=callback-code&state=bad"
      ),
      {
        params: Promise.resolve({ platform: "youtube_shorts" }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "CHANNEL_OAUTH_STATE_INVALID",
      message: "渠道授权 state 无效或已过期",
    });
  });

  it("refreshes a connected account token through the API", async () => {
    await seedConnectedAccount();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          access_token: "youtube-access-token-refreshed",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "https://www.googleapis.com/auth/youtube.upload",
        })
      )
    );

    const response = await refreshPOST(
      await createAuthenticatedRequest(
        "http://localhost/api/channel-accounts/youtube_shorts/refresh"
      ),
      {
        params: Promise.resolve({ platform: "youtube_shorts" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      message: "渠道 token 已刷新",
      data: {
        account: {
          platform: "youtube_shorts",
          status: "connected",
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("youtube-access-token-refreshed");
  });

  async function seedConnectedAccount() {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "youtube-access-token",
            refresh_token: "youtube-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/youtube.upload",
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            items: [
              {
                id: "youtube-channel-id",
                snippet: { title: "YouTube Channel" },
              },
            ],
          })
        )
    );
    const state = buildState();
    await callbackGET(
      await createAuthenticatedRequest(
        `http://localhost/api/channel-accounts/youtube_shorts/oauth/callback?code=callback-code&state=${encodeURIComponent(state)}`
      ),
      {
        params: Promise.resolve({ platform: "youtube_shorts" }),
      }
    );
  }

  function buildState(): string {
    const authorization = getChannelAuthorizationEntry(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      { env: realOAuthEnv }
    );

    return new URL(
      authorization.success ? authorization.data.authorization.authorizationUrl : ""
    ).searchParams.get("state")!;
  }

  async function createAuthenticatedRequest(url: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "real-channel-oauth-api@example.com",
      name: "Real Channel OAuth API User",
      teamId,
    });
    const request = new NextRequest(url);
    request.cookies.set("session", token);

    return request;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
