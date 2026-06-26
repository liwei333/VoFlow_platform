import { randomUUID } from "node:crypto";
import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import {
  MOCK_CHANNEL_AUTH_LIMITS,
  mockChannelOAuthAdapter,
  type SerializedChannelAuthorization,
} from "@/lib/publish/oauth";
import {
  getPublishPlatformRule,
  isPublishPlatform,
  type PublishPlatform,
} from "@/lib/publish/rules";
import {
  CHANNEL_TOKEN_ERROR_CODES,
  type ChannelTokenEnv,
} from "@/lib/publish/token";
import { saveChannelAccountToken } from "@/services/channelAccountService";

export type ChannelOAuthErrorCode =
  | "PUBLISH_PLATFORM_UNSUPPORTED"
  | typeof CHANNEL_TOKEN_ERROR_CODES.missingSecret;

export interface GetChannelAuthorizationInput {
  platform: string;
}

export interface MockAuthorizeChannelAccountInput {
  teamId: string;
  userId: string;
  platform: string;
  accountName?: string | null;
  expiresInDays?: number;
}

export interface ChannelOAuthServiceOptions {
  env?: ChannelTokenEnv;
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

export function getChannelAuthorizationEntry(
  input: GetChannelAuthorizationInput
): GetChannelAuthorizationResult {
  const platform = normalizePublishPlatform(input.platform);
  if (!platform.success) {
    return platform;
  }

  return {
    success: true,
    data: {
      authorization: mockChannelOAuthAdapter.getAuthorization(platform.data),
    },
  };
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
