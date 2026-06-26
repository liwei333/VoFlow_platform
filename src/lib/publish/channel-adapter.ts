import {
  PublishRealPlatformConfigError,
  buildPublishRealPlatformConfig,
  type PublishRealPlatformConfig,
  type PublishRealPlatformEnv,
} from "@/lib/publish/config";
import { createYoutubeChannelAdapter } from "@/lib/publish/youtube-adapter";
import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";

export const PUBLISH_CHANNEL_ADAPTER_PROVIDERS = {
  mock: "mock",
  youtube: "youtube",
} as const;

export const PUBLISH_ADAPTER_ERROR_CODES = {
  notConfigured: "PUBLISH_REAL_PLATFORM_NOT_CONFIGURED",
  finalVideoNotFound: "PUBLISH_FINAL_VIDEO_NOT_FOUND",
  validationFailed: "PUBLISH_VALIDATION_FAILED",
  uploadFailed: "PUBLISH_UPLOAD_FAILED",
  remoteFailed: "PUBLISH_REMOTE_FAILED",
  rateLimited: "PUBLISH_RATE_LIMITED",
  reviewRequired: "PUBLISH_PLATFORM_REVIEW_REQUIRED",
  statusSyncFailed: "PUBLISH_STATUS_SYNC_FAILED",
} as const;

export const PUBLISH_ADAPTER_REMOTE_STATUSES = {
  pending: "pending",
  uploading: "uploading",
  published: "published",
  failed: "failed",
} as const;

export type PublishChannelAdapterProvider =
  (typeof PUBLISH_CHANNEL_ADAPTER_PROVIDERS)[keyof typeof PUBLISH_CHANNEL_ADAPTER_PROVIDERS];

export type PublishAdapterErrorCode =
  (typeof PUBLISH_ADAPTER_ERROR_CODES)[keyof typeof PUBLISH_ADAPTER_ERROR_CODES];

export type PublishAdapterRemoteStatus =
  (typeof PUBLISH_ADAPTER_REMOTE_STATUSES)[keyof typeof PUBLISH_ADAPTER_REMOTE_STATUSES];

export interface ChannelAdapterValidationSnapshot {
  passed: boolean;
  platform: PublishPlatform;
  checks: unknown[];
}

export interface ChannelAdapterPublishInput {
  platform: PublishPlatform;
  publishDraftId: string;
  channelAccountId: string;
  finalVideoArtifactId: string;
  title: string;
  description: string;
  tags: string[];
  topics: string[];
  coverArtifactId: string | null;
  validationJson: ChannelAdapterValidationSnapshot;
  finalVideo?: ChannelAdapterFinalVideoInput;
}

export interface ChannelAdapterPublishWithVideoInput extends ChannelAdapterPublishInput {
  remoteVideoId: string;
}

export interface ChannelAdapterStatusInput {
  platform: PublishPlatform;
  requestId: string;
  remotePublishId?: string | null;
}

export interface ChannelAdapterRetryInput extends ChannelAdapterPublishWithVideoInput {
  previousRequestId: string;
}

export type ChannelAdapterResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: PublishAdapterErrorCode;
        message: string;
      };
    };

export interface ChannelAdapterUploadResult {
  provider: PublishChannelAdapterProvider;
  platform: PublishPlatform;
  requestId: string;
  remoteVideoId: string;
  remoteStatus?: unknown;
}

export interface ChannelAdapterPublishResult {
  provider: PublishChannelAdapterProvider;
  platform: PublishPlatform;
  requestId: string;
  remotePublishId: string;
  status: PublishAdapterRemoteStatus;
  remoteUrl?: string | null;
  remoteStatus?: unknown;
}

export interface ChannelAdapterStatusResult extends ChannelAdapterPublishResult {
  remoteUrl: string | null;
}

export interface ChannelAdapterRetryResult extends ChannelAdapterPublishResult {
  previousRequestId: string;
}

export interface ChannelAdapterFinalVideoInput {
  id: string;
  storageUrl: string;
  contentType: string;
  sizeBytes: number | null;
  stream: NodeJS.ReadableStream;
}

export interface PublishChannelAdapter {
  platform: PublishPlatform;
  provider: PublishChannelAdapterProvider;
  isMock: boolean;
  uploadVideo(input: ChannelAdapterPublishInput): Promise<ChannelAdapterResult<ChannelAdapterUploadResult>>;
  publish(
    input: ChannelAdapterPublishWithVideoInput
  ): Promise<ChannelAdapterResult<ChannelAdapterPublishResult>>;
  getStatus(input: ChannelAdapterStatusInput): Promise<ChannelAdapterResult<ChannelAdapterStatusResult>>;
  retry(input: ChannelAdapterRetryInput): Promise<ChannelAdapterResult<ChannelAdapterRetryResult>>;
}

export interface GetChannelAdapterOptions {
  env?: PublishRealPlatformEnv;
  accessToken?: string;
  config?: PublishRealPlatformConfig;
  fetchImpl?: typeof fetch;
}

export function getChannelAdapter(
  platform: PublishPlatform,
  optionsOrEnv: PublishRealPlatformEnv | GetChannelAdapterOptions = process.env
): PublishChannelAdapter {
  getPublishPlatformRule(platform);

  const options = normalizeAdapterOptions(optionsOrEnv);
  const realPlatformConfig = options.config ?? buildPublishRealPlatformConfig(options.env);
  if (realPlatformConfig.realAdapterEnabled && !realPlatformConfig.validation.passed) {
    throw new PublishRealPlatformConfigError(
      realPlatformConfig.validation.error?.message ?? "真实发布配置不完整",
      realPlatformConfig.validation.missingEnvKeys
    );
  }

  if (realPlatformConfig.realAdapterEnabled && platform === "youtube_shorts") {
    if (!options.accessToken) {
      throw new PublishRealPlatformConfigError(
        "真实发布 Adapter 缺少访问令牌"
      );
    }

    return createYoutubeChannelAdapter({
      accessToken: options.accessToken,
      config: realPlatformConfig,
      fetchImpl: options.fetchImpl,
    });
  }

  if (realPlatformConfig.realAdapterEnabled && !realPlatformConfig.allowMockAdapter) {
    throw new PublishRealPlatformConfigError(
      "真实发布 Adapter 尚未接入，不能在禁用 mock 回退时继续发布"
    );
  }

  return createMockChannelAdapter(platform);
}

export function createMockChannelAdapter(platform: PublishPlatform): PublishChannelAdapter {
  getPublishPlatformRule(platform);

  return {
    platform,
    provider: PUBLISH_CHANNEL_ADAPTER_PROVIDERS.mock,
    isMock: true,
    async uploadVideo(input) {
      const validation = requirePassedValidation(input);
      if (!validation.success) {
        return validation;
      }

      return {
        success: true,
        data: {
          provider: PUBLISH_CHANNEL_ADAPTER_PROVIDERS.mock,
          platform,
          requestId: buildMockRequestId("upload", platform, input.publishDraftId),
          remoteVideoId: `mock-video-${platform}-${input.finalVideoArtifactId}`,
        },
      };
    },
    async publish(input) {
      const validation = requirePassedValidation(input);
      if (!validation.success) {
        return validation;
      }

      return {
        success: true,
        data: {
          provider: PUBLISH_CHANNEL_ADAPTER_PROVIDERS.mock,
          platform,
          requestId: buildMockRequestId("publish", platform, input.publishDraftId),
          remotePublishId: buildMockRequestId("publish", platform, input.publishDraftId),
          status: PUBLISH_ADAPTER_REMOTE_STATUSES.published,
        },
      };
    },
    async getStatus(input) {
      const remotePublishId =
        input.remotePublishId ?? input.requestId.replace("mock-status", "mock-publish");

      return {
        success: true,
        data: {
          provider: PUBLISH_CHANNEL_ADAPTER_PROVIDERS.mock,
          platform,
          requestId: input.requestId,
          remotePublishId,
          status: PUBLISH_ADAPTER_REMOTE_STATUSES.published,
          remoteUrl: `mock://${platform}/${remotePublishId}`,
        },
      };
    },
    async retry(input) {
      const validation = requirePassedValidation(input);
      if (!validation.success) {
        return validation;
      }

      return {
        success: true,
        data: {
          provider: PUBLISH_CHANNEL_ADAPTER_PROVIDERS.mock,
          platform,
          requestId: buildMockRequestId("retry", platform, input.publishDraftId),
          remotePublishId: buildMockRequestId("publish", platform, input.publishDraftId),
          status: PUBLISH_ADAPTER_REMOTE_STATUSES.published,
          previousRequestId: input.previousRequestId,
        },
      };
    },
  };
}

export function isSuccessfulAdapterResult<T>(
  result: ChannelAdapterResult<T>
): result is Extract<ChannelAdapterResult<T>, { success: true }> {
  return result.success;
}

function requirePassedValidation(
  input: Pick<ChannelAdapterPublishInput, "platform" | "validationJson">
): ChannelAdapterResult<never> {
  if (
    !input.validationJson ||
    !input.validationJson.passed ||
    input.validationJson.platform !== input.platform
  ) {
    return {
      success: false,
      error: {
        code: PUBLISH_ADAPTER_ERROR_CODES.validationFailed,
        message: "发布参数检查未通过",
      },
    };
  }

  return {
    success: true,
    data: undefined as never,
  };
}

function buildMockRequestId(
  action: "upload" | "publish" | "retry",
  platform: PublishPlatform,
  publishDraftId: string
): string {
  return `mock-${action}-${platform}-${publishDraftId}`;
}

function normalizeAdapterOptions(
  optionsOrEnv: PublishRealPlatformEnv | GetChannelAdapterOptions
): GetChannelAdapterOptions {
  if (isGetChannelAdapterOptions(optionsOrEnv)) {
    return optionsOrEnv;
  }

  return {
    env: optionsOrEnv,
  };
}

function isGetChannelAdapterOptions(
  value: PublishRealPlatformEnv | GetChannelAdapterOptions
): value is GetChannelAdapterOptions {
  return (
    "env" in value ||
    "accessToken" in value ||
    "config" in value ||
    "fetchImpl" in value
  );
}
