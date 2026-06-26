import { createHmac, timingSafeEqual } from "node:crypto";
import {
  buildPublishRealPlatformConfig,
  type PublishRealPlatformEnv,
} from "@/lib/publish/config";
import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";
import { requireChannelTokenSecret } from "@/lib/publish/token";

export const CHANNEL_OAUTH_PROVIDER_TYPES = {
  mock: "mock",
  youtube: "youtube",
} as const;

export const CHANNEL_OAUTH_STATUS = {
  authorizationRequired: "authorization_required",
  mockAvailable: "mock_available",
} as const;

export const CHANNEL_OAUTH_ERROR_CODES = {
  stateInvalid: "CHANNEL_OAUTH_STATE_INVALID",
  exchangeFailed: "CHANNEL_OAUTH_EXCHANGE_FAILED",
  tokenExpired: "CHANNEL_TOKEN_EXPIRED",
  refreshFailed: "CHANNEL_TOKEN_REFRESH_FAILED",
} as const;

export const MOCK_CHANNEL_AUTH_LIMITS = {
  defaultExpiresInDays: 30,
  minExpiresInDays: 1,
  maxExpiresInDays: 365,
} as const;

export type ChannelOAuthProviderType =
  (typeof CHANNEL_OAUTH_PROVIDER_TYPES)[keyof typeof CHANNEL_OAUTH_PROVIDER_TYPES];

export type ChannelOAuthErrorCode =
  (typeof CHANNEL_OAUTH_ERROR_CODES)[keyof typeof CHANNEL_OAUTH_ERROR_CODES];

export interface SerializedChannelAuthorization {
  platform: PublishPlatform;
  platformLabel: string;
  provider: ChannelOAuthProviderType;
  status: (typeof CHANNEL_OAUTH_STATUS)[keyof typeof CHANNEL_OAUTH_STATUS];
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

export interface ChannelOAuthStatePayload {
  userId: string;
  teamId: string;
  platform: PublishPlatform;
  provider: ChannelOAuthProviderType;
  expiresAt: string;
}

export interface YoutubeTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export interface YoutubeAccountProfile {
  providerAccountId: string;
  accountName: string | null;
  metadata: {
    channelId: string;
    title: string | null;
    thumbnailUrl: string | null;
  };
}

export type ChannelOAuthFetch = typeof fetch;

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

export function serializeYoutubeChannelAuthorization(input: {
  platform: PublishPlatform;
  userId: string;
  teamId: string;
  env?: PublishRealPlatformEnv;
  now?: Date;
}): SerializedChannelAuthorization {
  const rule = getPublishPlatformRule(input.platform);
  const config = buildPublishRealPlatformConfig(input.env);
  if (!config.validation.passed) {
    throw new Error(config.validation.error?.message ?? "真实发布配置不完整");
  }

  const state = signChannelOAuthState(
    {
      userId: input.userId,
      teamId: input.teamId,
      platform: input.platform,
      provider: CHANNEL_OAUTH_PROVIDER_TYPES.youtube,
      expiresAt: new Date(
        (input.now ?? new Date()).getTime() + 15 * 60 * 1000
      ).toISOString(),
    },
    input.env
  );
  const url = new URL(config.youtube.oauthAuthorizationUrl);
  url.searchParams.set("client_id", config.youtube.clientId);
  url.searchParams.set("redirect_uri", config.youtube.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", config.youtube.scopes.join(" "));
  url.searchParams.set("state", state);

  return {
    platform: input.platform,
    platformLabel: rule.label,
    provider: CHANNEL_OAUTH_PROVIDER_TYPES.youtube,
    status: CHANNEL_OAUTH_STATUS.authorizationRequired,
    authorizationUrl: url.toString(),
    reauthorizeUrl: url.toString(),
    isMock: false,
  };
}

export function signChannelOAuthState(
  payload: ChannelOAuthStatePayload,
  env: PublishRealPlatformEnv = process.env
): string {
  const secret = requireChannelTokenSecret(env);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export function verifyChannelOAuthState(
  state: string,
  expected: {
    userId: string;
    teamId: string;
    platform: PublishPlatform;
  },
  env: PublishRealPlatformEnv = process.env,
  now = new Date()
):
  | { success: true; data: ChannelOAuthStatePayload }
  | {
      success: false;
      error: {
        code: typeof CHANNEL_OAUTH_ERROR_CODES.stateInvalid;
        message: string;
      };
    } {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return invalidState();
  }

  const secret = requireChannelTokenSecret(env);
  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return invalidState();
  }

  let payload: ChannelOAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return invalidState();
  }

  if (
    payload.userId !== expected.userId ||
    payload.teamId !== expected.teamId ||
    payload.platform !== expected.platform ||
    new Date(payload.expiresAt).getTime() <= now.getTime()
  ) {
    return invalidState();
  }

  return {
    success: true,
    data: payload,
  };
}

export async function exchangeYoutubeOAuthCode(input: {
  code: string;
  env?: PublishRealPlatformEnv;
  fetchImpl?: ChannelOAuthFetch;
  now?: Date;
}): Promise<YoutubeTokenResponse> {
  const config = buildPublishRealPlatformConfig(input.env);
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: config.youtube.clientId,
    client_secret: config.youtube.clientSecret,
    redirect_uri: config.youtube.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchImpl(config.youtube.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseYoutubeTokenResponse(response, input.now ?? new Date());
}

export async function refreshYoutubeAccessToken(input: {
  refreshToken: string;
  env?: PublishRealPlatformEnv;
  fetchImpl?: ChannelOAuthFetch;
  now?: Date;
}): Promise<YoutubeTokenResponse> {
  const config = buildPublishRealPlatformConfig(input.env);
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: config.youtube.clientId,
    client_secret: config.youtube.clientSecret,
    grant_type: "refresh_token",
  });
  const response = await fetchImpl(config.youtube.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseYoutubeTokenResponse(response, input.now ?? new Date());
}

export async function fetchYoutubeAccountProfile(input: {
  accessToken: string;
  env?: PublishRealPlatformEnv;
  fetchImpl?: ChannelOAuthFetch;
}): Promise<YoutubeAccountProfile> {
  const config = buildPublishRealPlatformConfig(input.env);
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(`${config.youtube.apiBaseUrl}/channels`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  const response = await fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(CHANNEL_OAUTH_ERROR_CODES.exchangeFailed);
  }

  const payload = await response.json();
  const firstItem = Array.isArray(payload.items) ? payload.items[0] : null;
  const channelId = typeof firstItem?.id === "string" ? firstItem.id : null;
  if (!channelId) {
    throw new Error(CHANNEL_OAUTH_ERROR_CODES.exchangeFailed);
  }

  const title = typeof firstItem?.snippet?.title === "string" ? firstItem.snippet.title : null;
  const thumbnailUrl =
    typeof firstItem?.snippet?.thumbnails?.default?.url === "string"
      ? firstItem.snippet.thumbnails.default.url
      : null;

  return {
    providerAccountId: channelId,
    accountName: title,
    metadata: {
      channelId,
      title,
      thumbnailUrl,
    },
  };
}

export function buildMockAuthorizePath(platform: PublishPlatform): string {
  return `/api/channel-accounts/${platform}/mock-authorize`;
}

function invalidState() {
  return {
    success: false as const,
    error: {
      code: CHANNEL_OAUTH_ERROR_CODES.stateInvalid,
      message: "渠道授权 state 无效或已过期",
    },
  };
}

async function parseYoutubeTokenResponse(
  response: Response,
  now: Date
): Promise<YoutubeTokenResponse> {
  if (!response.ok) {
    throw new Error(CHANNEL_OAUTH_ERROR_CODES.exchangeFailed);
  }

  const payload = await response.json();
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) {
    throw new Error(CHANNEL_OAUTH_ERROR_CODES.exchangeFailed);
  }

  const expiresInSeconds =
    typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? payload.expires_in
      : null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";

  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    tokenType: typeof payload.token_type === "string" ? payload.token_type : null,
    expiresAt: expiresInSeconds ? new Date(now.getTime() + expiresInSeconds * 1000) : null,
    scopes: scope.split(/\s+/).filter(Boolean),
  };
}
