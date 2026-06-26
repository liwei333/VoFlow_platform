import { randomUUID } from "node:crypto";
import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import { buildPublishRealPlatformConfig, type PublishRealPlatformEnv } from "@/lib/publish/config";
import {
  CHANNEL_OAUTH_ERROR_CODES,
  MOCK_CHANNEL_AUTH_LIMITS,
  exchangeYoutubeOAuthCode,
  fetchYoutubeAccountProfile,
  mockChannelOAuthAdapter,
  refreshYoutubeAccessToken,
  serializeYoutubeChannelAuthorization,
  verifyChannelOAuthState,
  type SerializedChannelAuthorization,
  type ChannelOAuthFetch,
} from "@/lib/publish/oauth";
import {
  getPublishPlatformRule,
  isPublishPlatform,
  type PublishPlatform,
} from "@/lib/publish/rules";
import {
  CHANNEL_TOKEN_ERROR_CODES,
  decryptChannelToken,
  requireChannelTokenSecret,
  type ChannelTokenEnv,
} from "@/lib/publish/token";
import {
  saveChannelAccountToken,
  saveRealChannelAccountToken,
  updateRealChannelAccountAccessToken,
} from "@/services/channelAccountService";
import { prisma } from "@/lib/db";

export type ChannelOAuthErrorCode =
  | "PUBLISH_PLATFORM_UNSUPPORTED"
  | typeof CHANNEL_TOKEN_ERROR_CODES.missingSecret
  | typeof CHANNEL_OAUTH_ERROR_CODES.stateInvalid
  | typeof CHANNEL_OAUTH_ERROR_CODES.exchangeFailed
  | typeof CHANNEL_OAUTH_ERROR_CODES.refreshFailed
  | typeof CHANNEL_OAUTH_ERROR_CODES.tokenExpired;

export interface GetChannelAuthorizationInput {
  platform: string;
  teamId?: string;
  userId?: string;
}

export interface MockAuthorizeChannelAccountInput {
  teamId: string;
  userId: string;
  platform: string;
  accountName?: string | null;
  expiresInDays?: number;
}

export interface ChannelOAuthServiceOptions {
  env?: ChannelTokenEnv & PublishRealPlatformEnv;
  fetchImpl?: ChannelOAuthFetch;
  now?: Date;
}

export interface HandleChannelOAuthCallbackInput {
  platform: string;
  teamId: string;
  userId: string;
  code?: string | null;
  state?: string | null;
  error?: string | null;
}

export interface RefreshChannelAccountTokenInput {
  platform: string;
  teamId: string;
  userId: string;
}

export type GetChannelAuthorizationResult =
  | {
      success: true;
      data: {
        authorization: SerializedChannelAuthorization;
      };
    }
  | {
      success: false;
      error: {
        code: ChannelOAuthErrorCode;
        message: string;
      };
    };

export type MockAuthorizeChannelAccountResult =
  | {
      success: true;
      data: {
        account: SerializedChannelAccount;
        authorization: SerializedChannelAuthorization;
      };
    }
  | {
      success: false;
      error: {
        code: ChannelOAuthErrorCode;
        message: string;
      };
    };

export type HandleChannelOAuthCallbackResult = MockAuthorizeChannelAccountResult;

export type RefreshChannelAccountTokenResult =
  | {
      success: true;
      data: {
        account: SerializedChannelAccount;
      };
    }
  | {
      success: false;
      error: {
        code: ChannelOAuthErrorCode;
        message: string;
      };
    };

export function getChannelAuthorizationEntry(
  input: GetChannelAuthorizationInput,
  options: ChannelOAuthServiceOptions = {}
): GetChannelAuthorizationResult {
  const platform = normalizePublishPlatform(input.platform);
  if (!platform.success) {
    return platform;
  }

  const realConfig = buildPublishRealPlatformConfig(options.env);
  if (realConfig.realAdapterEnabled && platform.data === "youtube_shorts") {
    if (!input.teamId || !input.userId) {
      return {
        success: false,
        error: {
          code: CHANNEL_OAUTH_ERROR_CODES.stateInvalid,
          message: "渠道授权上下文缺失",
        },
      };
    }

    try {
      return {
        success: true,
        data: {
          authorization: serializeYoutubeChannelAuthorization({
            platform: platform.data,
            teamId: input.teamId,
            userId: input.userId,
            env: options.env,
            now: options.now,
          }),
        },
      };
    } catch {
      return {
        success: false,
        error: {
          code: "CHANNEL_TOKEN_SECRET_MISSING",
          message: "渠道授权配置缺失",
        },
      };
    }
  }

  return {
    success: true,
    data: {
      authorization: mockChannelOAuthAdapter.getAuthorization(platform.data),
    },
  };
}

export async function handleChannelOAuthCallback(
  input: HandleChannelOAuthCallbackInput,
  options: ChannelOAuthServiceOptions = {}
): Promise<HandleChannelOAuthCallbackResult> {
  const platform = normalizePublishPlatform(input.platform);
  if (!platform.success) {
    return platform;
  }

  if (input.error || !input.code || !input.state) {
    return {
      success: false,
      error: {
        code: CHANNEL_OAUTH_ERROR_CODES.exchangeFailed,
        message: "渠道授权失败",
      },
    };
  }

  const verifiedState = verifyChannelOAuthState(
    input.state,
    {
      teamId: input.teamId,
      userId: input.userId,
      platform: platform.data,
    },
    options.env,
    options.now
  );
  if (!verifiedState.success) {
    return verifiedState;
  }

  try {
    const token = await exchangeYoutubeOAuthCode({
      code: input.code,
      env: options.env,
      fetchImpl: options.fetchImpl,
      now: options.now,
    });
    const profile = await fetchYoutubeAccountProfile({
      accessToken: token.accessToken,
      env: options.env,
      fetchImpl: options.fetchImpl,
    });
    const saved = await saveRealChannelAccountToken(
      {
        teamId: input.teamId,
        userId: input.userId,
        platform: platform.data,
        provider: "youtube",
        providerAccountId: profile.providerAccountId,
        accountName: profile.accountName,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        scopes: token.scopes,
        metadata: profile.metadata,
        expiresAt: token.expiresAt,
        authorizedAt: options.now,
      },
      {
        env: options.env,
      }
    );

    if (!saved.success) {
      return {
        success: false,
        error: saved.error,
      };
    }

    return {
      success: true,
      data: {
        account: saved.data.account,
        authorization: serializeYoutubeChannelAuthorization({
          platform: platform.data,
          teamId: input.teamId,
          userId: input.userId,
          env: options.env,
          now: options.now,
        }),
      },
    };
  } catch {
    return {
      success: false,
      error: {
        code: CHANNEL_OAUTH_ERROR_CODES.exchangeFailed,
        message: "渠道授权换取 token 失败",
      },
    };
  }
}

export async function refreshChannelAccountToken(
  input: RefreshChannelAccountTokenInput,
  options: ChannelOAuthServiceOptions = {}
): Promise<RefreshChannelAccountTokenResult> {
  const platform = normalizePublishPlatform(input.platform);
  if (!platform.success) {
    return platform;
  }

  const account = await prisma.channelAccount.findFirst({
    where: {
      teamId: input.teamId,
      userId: input.userId,
      platform: platform.data,
    },
    select: {
      id: true,
      encryptedRefreshToken: true,
    },
  });
  if (!account?.encryptedRefreshToken) {
    return {
      success: false,
      error: {
        code: CHANNEL_OAUTH_ERROR_CODES.tokenExpired,
        message: "渠道 refresh token 不存在，请重新授权",
      },
    };
  }

  try {
    const secret = requireChannelTokenSecret(options.env);
    const refreshToken = decryptChannelToken(account.encryptedRefreshToken, secret);
    const token = await refreshYoutubeAccessToken({
      refreshToken,
      env: options.env,
      fetchImpl: options.fetchImpl,
      now: options.now,
    });
    const saved = await updateRealChannelAccountAccessToken(
      {
        accountId: account.id,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenType: token.tokenType,
        scopes: token.scopes,
        expiresAt: token.expiresAt,
        refreshedAt: options.now ?? new Date(),
      },
      {
        env: options.env,
      }
    );

    if (!saved.success) {
      return {
        success: false,
        error: saved.error,
      };
    }

    return {
      success: true,
      data: {
        account: saved.data.account,
      },
    };
  } catch {
    await prisma.channelAccount.update({
      where: {
        id: account.id,
      },
      data: {
        status: "expired",
        lastErrorJson: {
          code: CHANNEL_OAUTH_ERROR_CODES.refreshFailed,
          message: "渠道 token 刷新失败",
        },
      },
    });

    return {
      success: false,
      error: {
        code: CHANNEL_OAUTH_ERROR_CODES.refreshFailed,
        message: "渠道 token 刷新失败",
      },
    };
  }
}

export async function mockAuthorizeChannelAccount(
  input: MockAuthorizeChannelAccountInput,
  options: ChannelOAuthServiceOptions = {}
): Promise<MockAuthorizeChannelAccountResult> {
  const platform = normalizePublishPlatform(input.platform);
  if (!platform.success) {
    return platform;
  }

  const rule = getPublishPlatformRule(platform.data);
  const expiresAt = buildMockExpiresAt(input.expiresInDays);
  const saved = await saveChannelAccountToken(
    {
      teamId: input.teamId,
      userId: input.userId,
      platform: platform.data,
      accountName: input.accountName?.trim() || `${rule.label} Mock Account`,
      token: createMockToken(platform.data),
      expiresAt,
      status: "connected",
    },
    {
      env: options.env,
    }
  );

  if (!saved.success) {
    return {
      success: false,
      error: {
        code: saved.error.code,
        message: saved.error.message,
      },
    };
  }

  return {
    success: true,
    data: {
      account: saved.data.account,
      authorization: mockChannelOAuthAdapter.getAuthorization(platform.data),
    },
  };
}

function normalizePublishPlatform(platform: string):
  | { success: true; data: PublishPlatform }
  | {
      success: false;
      error: {
        code: "PUBLISH_PLATFORM_UNSUPPORTED";
        message: string;
      };
    } {
  if (!isPublishPlatform(platform)) {
    return {
      success: false,
      error: {
        code: "PUBLISH_PLATFORM_UNSUPPORTED",
        message: "不支持该发布平台",
      },
    };
  }

  return {
    success: true,
    data: platform,
  };
}

function buildMockExpiresAt(expiresInDays?: number): Date {
  const days = Math.min(
    Math.max(
      expiresInDays ?? MOCK_CHANNEL_AUTH_LIMITS.defaultExpiresInDays,
      MOCK_CHANNEL_AUTH_LIMITS.minExpiresInDays
    ),
    MOCK_CHANNEL_AUTH_LIMITS.maxExpiresInDays
  );

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function createMockToken(platform: PublishPlatform): string {
  return `mock:${platform}:${randomUUID()}`;
}
