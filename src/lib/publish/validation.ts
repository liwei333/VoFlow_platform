import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import type { PublishAspectRatio, PublishPlatform } from "@/lib/publish/rules";

export const PUBLISH_VALIDATION_ERROR_CODES = {
  jobNotFound: "PUBLISH_JOB_NOT_FOUND",
  validationFailed: "PUBLISH_VALIDATION_FAILED",
} as const;

export const PUBLISH_VALIDATION_CHECK_CODES = {
  titleValid: "PUBLISH_TITLE_VALID",
  titleRequired: "PUBLISH_TITLE_REQUIRED",
  titleTooLong: "PUBLISH_TITLE_TOO_LONG",
  tagsValid: "PUBLISH_TAGS_VALID",
  tagsTooMany: "PUBLISH_TAGS_TOO_MANY",
  coverRatioValid: "PUBLISH_COVER_RATIO_VALID",
  coverRequired: "PUBLISH_COVER_REQUIRED",
  coverRatioUnsupported: "PUBLISH_COVER_RATIO_UNSUPPORTED",
  finalVideoReady: "PUBLISH_FINAL_VIDEO_READY",
  finalVideoNotReady: "PUBLISH_FINAL_VIDEO_NOT_READY",
  videoRatioValid: "PUBLISH_VIDEO_RATIO_VALID",
  videoRatioUnsupported: "PUBLISH_VIDEO_RATIO_UNSUPPORTED",
  videoDurationValid: "PUBLISH_VIDEO_DURATION_VALID",
  videoDurationMissing: "PUBLISH_VIDEO_DURATION_MISSING",
  videoDurationOutOfRange: "PUBLISH_VIDEO_DURATION_OUT_OF_RANGE",
  channelAccountConnected: "PUBLISH_CHANNEL_ACCOUNT_CONNECTED",
  channelAccountNotConnected: "CHANNEL_ACCOUNT_NOT_CONNECTED",
  channelTokenExpired: "CHANNEL_TOKEN_EXPIRED",
  draftMissing: "PUBLISH_DRAFT_MISSING",
} as const;

export type PublishValidationCheckCode =
  (typeof PUBLISH_VALIDATION_CHECK_CODES)[keyof typeof PUBLISH_VALIDATION_CHECK_CODES];

export interface PublishValidationCheck {
  code: PublishValidationCheckCode;
  field:
    | "title"
    | "tags"
    | "cover"
    | "finalVideo"
    | "videoRatio"
    | "videoDuration"
    | "channelAccount"
    | "draft";
  passed: boolean;
  message: string;
  actual?: string | number | null;
  limit?: string | number | readonly PublishAspectRatio[] | null;
}

export interface PublishPlatformValidationResult {
  draftId: string | null;
  platform: PublishPlatform;
  passed: boolean;
  checkedAt: string;
  account: SerializedChannelAccount;
  finalVideoArtifactId: string | null;
  coverArtifactId: string | null;
  checks: PublishValidationCheck[];
}

export interface PublishValidationSummary {
  total: number;
  passed: number;
  failed: number;
  canPublish: boolean;
}

export interface PublishValidationPayload {
  summary: PublishValidationSummary;
  results: PublishPlatformValidationResult[];
}
