import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";

export const PUBLISH_CHANNEL_ADAPTER_PROVIDERS = {
  mock: "mock",
} as const;

export const PUBLISH_ADAPTER_ERROR_CODES = {
  validationFailed: "PUBLISH_VALIDATION_FAILED",
  uploadFailed: "PUBLISH_UPLOAD_FAILED",
  remoteFailed: "PUBLISH_REMOTE_FAILED",
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
}

export interface ChannelAdapterPublishResult {
  provider: PublishChannelAdapterProvider;
  platform: PublishPlatform;
  requestId: string;
  remotePublishId: string;
  status: PublishAdapterRemoteStatus;
}

export interface ChannelAdapterStatusResult extends ChannelAdapterPublishResult {
  remoteUrl: string | null;
}

export interface ChannelAdapterRetryResult extends ChannelAdapterPublishResult {
  previousRequestId: string;
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

export function getChannelAdapter(platform: PublishPlatform): PublishChannelAdapter {
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
