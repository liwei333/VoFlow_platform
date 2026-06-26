import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";

export const CHANNEL_OAUTH_PROVIDER_TYPES = {
  mock: "mock",
} as const;

export const CHANNEL_OAUTH_STATUS = {
  mockAvailable: "mock_available",
} as const;

export const MOCK_CHANNEL_AUTH_LIMITS = {
  defaultExpiresInDays: 30,
  minExpiresInDays: 1,
  maxExpiresInDays: 365,
} as const;

export type ChannelOAuthProviderType =
  (typeof CHANNEL_OAUTH_PROVIDER_TYPES)[keyof typeof CHANNEL_OAUTH_PROVIDER_TYPES];

export interface SerializedChannelAuthorization {
  platform: PublishPlatform;
  platformLabel: string;
  provider: ChannelOAuthProviderType;
  status: typeof CHANNEL_OAUTH_STATUS.mockAvailable;
  authorizationUrl: string;
  reauthorizeUrl: string;
  isMock: boolean;
}

export interface ChannelOAuthAdapter {
  provider: ChannelOAuthProviderType;
  getAuthorization(platform: PublishPlatform): SerializedChannelAuthorization;
}

export const mockChannelOAuthAdapter: ChannelOAuthAdapter = {
  provider: CHANNEL_OAUTH_PROVIDER_TYPES.mock,
  getAuthorization: serializeMockChannelAuthorization,
};

export function serializeMockChannelAuthorization(
  platform: PublishPlatform
): SerializedChannelAuthorization {
  const rule = getPublishPlatformRule(platform);
  const authorizationUrl = buildMockAuthorizePath(platform);

  return {
    platform,
    platformLabel: rule.label,
    provider: CHANNEL_OAUTH_PROVIDER_TYPES.mock,
    status: CHANNEL_OAUTH_STATUS.mockAvailable,
    authorizationUrl,
    reauthorizeUrl: authorizationUrl,
    isMock: true,
  };
}

export function buildMockAuthorizePath(platform: PublishPlatform): string {
  return `/api/channel-accounts/${platform}/mock-authorize`;
}
