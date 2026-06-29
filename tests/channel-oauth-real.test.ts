import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { decryptChannelToken, isEncryptedChannelToken } from "@/lib/publish/token";
import {
  getChannelAuthorizationEntry,
  handleChannelOAuthCallback,
  refreshChannelAccountToken,
} from "@/services/channelOAuthService";

const TEST_SECRET = "test-real-channel-oauth-secret";

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

describe("real channel OAuth service", () => {
  let userId: string;
  let teamId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `real_channel_oauth_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Real Channel OAuth User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Real Channel OAuth Team",
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
    vi.restoreAllMocks();
  });

  it("returns a real YouTube authorization URL with signed state", () => {
    const result = getChannelAuthorizationEntry(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      { env: realOAuthEnv }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.authorization).toMatchObject({
      platform: "youtube_shorts",
      provider: "youtube",
      isMock: false,
      status: "authorization_required",
    });

    const authorization = result.success ? result.data.authorization : null;
    const url = new URL(authorization!.authorizationUrl);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("youtube-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(realOAuthEnv.YOUTUBE_REDIRECT_URI);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("youtube.upload");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(authorization!.authorizationUrl).not.toContain("youtube-client-secret");
  });

  it("exchanges a callback code and stores encrypted access and refresh tokens", async () => {
    const authorization = getChannelAuthorizationEntry(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      { env: realOAuthEnv }
    );
    const state = new URL(
      authorization.success ? authorization.data.authorization.authorizationUrl : ""
    ).searchParams.get("state")!;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: "youtube-access-token",
          refresh_token: "youtube-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope:
            "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "youtube-channel-id",
              snippet: {
                title: "YouTube Channel",
                thumbnails: {
                  default: {
                    url: "https://example.com/avatar.jpg",
                  },
                },
              },
            },
          ],
        })
      );

    const result = await handleChannelOAuthCallback(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
        code: "callback-code",
        state,
      },
      {
        env: realOAuthEnv,
        fetchImpl,
        now: new Date("2026-06-26T00:00:00.000Z"),
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.account).toMatchObject({
      platform: "youtube_shorts",
      status: "connected",
      accountName: "YouTube Channel",
      provider: "youtube",
      providerAccountId: "youtube-channel-id",
      scopes: [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ],
    });
    expect(JSON.stringify(result)).not.toContain("youtube-access-token");
    expect(JSON.stringify(result)).not.toContain("youtube-refresh-token");
    expect(JSON.stringify(result)).not.toContain("callback-code");

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "youtube_shorts",
      },
    });
    expect(saved.provider).toBe("youtube");
    expect(saved.providerAccountId).toBe("youtube-channel-id");
    expect(saved.encryptedAccessToken).toBeTruthy();
    expect(saved.encryptedRefreshToken).toBeTruthy();
    expect(isEncryptedChannelToken(saved.encryptedAccessToken)).toBe(true);
    expect(isEncryptedChannelToken(saved.encryptedRefreshToken)).toBe(true);
    expect(decryptChannelToken(saved.encryptedAccessToken!, TEST_SECRET)).toBe(
      "youtube-access-token"
    );
    expect(decryptChannelToken(saved.encryptedRefreshToken!, TEST_SECRET)).toBe(
      "youtube-refresh-token"
    );
  });

  it("rejects callback state mismatches before exchanging the code", async () => {
    const fetchImpl = vi.fn();

    const result = await handleChannelOAuthCallback(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
        code: "callback-code",
        state: "invalid-state",
      },
      {
        env: realOAuthEnv,
        fetchImpl,
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "CHANNEL_OAUTH_STATE_INVALID",
        message: "渠道授权 state 无效或已过期",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a sanitized exchange error without saving a channel account", async () => {
    const authorization = getChannelAuthorizationEntry(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      { env: realOAuthEnv }
    );
    const state = new URL(
      authorization.success ? authorization.data.authorization.authorizationUrl : ""
    ).searchParams.get("state")!;
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: "invalid_grant",
          error_description:
            "callback-code youtube-client-secret youtube-access-token",
        },
        400
      )
    );

    const result = await handleChannelOAuthCallback(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
        code: "callback-code",
        state,
      },
      {
        env: realOAuthEnv,
        fetchImpl,
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "CHANNEL_OAUTH_EXCHANGE_FAILED",
        message: "渠道授权换取 token 失败",
      },
    });
    expect(JSON.stringify(result)).not.toContain("callback-code");
    expect(JSON.stringify(result)).not.toContain("youtube-client-secret");
    expect(JSON.stringify(result)).not.toContain("youtube-access-token");
    await expect(
      prisma.channelAccount.count({ where: { teamId, userId } })
    ).resolves.toBe(0);
  });

  it("refreshes an expired real channel token without leaking token values", async () => {
    await handleSavedRealAccount();
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        access_token: "youtube-access-token-refreshed",
        expires_in: 7200,
        token_type: "Bearer",
        scope: "https://www.googleapis.com/auth/youtube.upload",
      })
    );

    const result = await refreshChannelAccountToken(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      {
        env: realOAuthEnv,
        fetchImpl,
        now: new Date("2026-06-26T01:00:00.000Z"),
      }
    );

    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain("youtube-access-token-refreshed");

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "youtube_shorts",
      },
    });
    expect(saved.status).toBe("connected");
    expect(saved.lastRefreshAt?.toISOString()).toBe("2026-06-26T01:00:00.000Z");
    expect(decryptChannelToken(saved.encryptedAccessToken!, TEST_SECRET)).toBe(
      "youtube-access-token-refreshed"
    );
    expect(decryptChannelToken(saved.encryptedRefreshToken!, TEST_SECRET)).toBe(
      "youtube-refresh-token"
    );
  });

  it("marks the account expired with a sanitized refresh error", async () => {
    await handleSavedRealAccount();
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: "invalid_grant",
          error_description: "youtube-refresh-token youtube-client-secret",
        },
        400
      )
    );

    const result = await refreshChannelAccountToken(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      {
        env: realOAuthEnv,
        fetchImpl,
        now: new Date("2026-06-26T01:00:00.000Z"),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "CHANNEL_TOKEN_REFRESH_FAILED",
        message: "渠道 token 刷新失败",
      },
    });
    expect(JSON.stringify(result)).not.toContain("youtube-refresh-token");
    expect(JSON.stringify(result)).not.toContain("youtube-client-secret");

    const saved = await prisma.channelAccount.findFirstOrThrow({
      where: {
        teamId,
        userId,
        platform: "youtube_shorts",
      },
    });
    expect(saved.status).toBe("expired");
    expect(saved.lastErrorJson).toEqual({
      code: "CHANNEL_TOKEN_REFRESH_FAILED",
      message: "渠道 token 刷新失败",
    });
  });

  async function handleSavedRealAccount() {
    await prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: "youtube_shorts",
        provider: "youtube",
        providerAccountId: "youtube-channel-id",
        accountName: "YouTube Channel",
        encryptedAccessToken: "placeholder",
        encryptedRefreshToken: "placeholder",
      },
    });

    const authorization = getChannelAuthorizationEntry(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
      },
      { env: realOAuthEnv }
    );
    const state = new URL(
      authorization.success ? authorization.data.authorization.authorizationUrl : ""
    ).searchParams.get("state")!;

    await handleChannelOAuthCallback(
      {
        platform: "youtube_shorts",
        teamId,
        userId,
        code: "callback-code",
        state,
      },
      {
        env: realOAuthEnv,
        fetchImpl: vi
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
          ),
      }
    );
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
