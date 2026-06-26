export const PUBLISH_PLATFORMS = [
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "wechat_channels",
  "bilibili",
  "youtube_shorts",
  "tiktok",
] as const;

export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export const PUBLISH_PLATFORM_ERROR_CODES = {
  UNSUPPORTED: "PUBLISH_PLATFORM_UNSUPPORTED",
} as const;

export type PublishPlatformErrorCode =
  (typeof PUBLISH_PLATFORM_ERROR_CODES)[keyof typeof PUBLISH_PLATFORM_ERROR_CODES];

export type PublishAspectRatio = "9:16" | "16:9" | "1:1" | "3:4" | "4:3" | "16:10";

export interface PublishTitleRule {
  maxChars: number;
}

export interface PublishTagRule {
  maxCount: number;
}

export interface PublishCoverRule {
  allowedAspectRatios: readonly PublishAspectRatio[];
  recommendedAspectRatio: PublishAspectRatio;
}

export interface PublishVideoRule {
  allowedAspectRatios: readonly PublishAspectRatio[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
}

export interface PublishPlatformRule {
  platform: PublishPlatform;
  label: string;
  title: PublishTitleRule;
  tags: PublishTagRule;
  cover: PublishCoverRule;
  video: PublishVideoRule;
}

export const PUBLISH_PLATFORM_RULES: Record<PublishPlatform, PublishPlatformRule> = {
  douyin: {
    platform: "douyin",
    label: "抖音",
    title: { maxChars: 55 },
    tags: { maxCount: 5 },
    cover: {
      allowedAspectRatios: ["9:16", "16:9"],
      recommendedAspectRatio: "9:16",
    },
    video: {
      allowedAspectRatios: ["9:16", "16:9"],
      minDurationSeconds: 1,
      maxDurationSeconds: 900,
    },
  },
  kuaishou: {
    platform: "kuaishou",
    label: "快手",
    title: { maxChars: 60 },
    tags: { maxCount: 5 },
    cover: {
      allowedAspectRatios: ["9:16", "16:9"],
      recommendedAspectRatio: "9:16",
    },
    video: {
      allowedAspectRatios: ["9:16", "16:9"],
      minDurationSeconds: 1,
      maxDurationSeconds: 600,
    },
  },
  xiaohongshu: {
    platform: "xiaohongshu",
    label: "小红书",
    title: { maxChars: 20 },
    tags: { maxCount: 10 },
    cover: {
      allowedAspectRatios: ["3:4", "1:1", "4:3", "9:16"],
      recommendedAspectRatio: "3:4",
    },
    video: {
      allowedAspectRatios: ["9:16", "1:1", "3:4"],
      minDurationSeconds: 1,
      maxDurationSeconds: 300,
    },
  },
  wechat_channels: {
    platform: "wechat_channels",
    label: "视频号",
    title: { maxChars: 30 },
    tags: { maxCount: 10 },
    cover: {
      allowedAspectRatios: ["9:16", "16:9"],
      recommendedAspectRatio: "9:16",
    },
    video: {
      allowedAspectRatios: ["9:16", "16:9"],
      minDurationSeconds: 1,
      maxDurationSeconds: 1800,
    },
  },
  bilibili: {
    platform: "bilibili",
    label: "B站",
    title: { maxChars: 80 },
    tags: { maxCount: 12 },
    cover: {
      allowedAspectRatios: ["16:10", "16:9"],
      recommendedAspectRatio: "16:10",
    },
    video: {
      allowedAspectRatios: ["16:9", "16:10"],
      minDurationSeconds: 1,
      maxDurationSeconds: 7200,
    },
  },
  youtube_shorts: {
    platform: "youtube_shorts",
    label: "YouTube Shorts",
    title: { maxChars: 100 },
    tags: { maxCount: 15 },
    cover: {
      allowedAspectRatios: ["9:16", "1:1"],
      recommendedAspectRatio: "9:16",
    },
    video: {
      allowedAspectRatios: ["9:16", "1:1"],
      minDurationSeconds: 1,
      maxDurationSeconds: 180,
    },
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    title: { maxChars: 2200 },
    tags: { maxCount: 20 },
    cover: {
      allowedAspectRatios: ["9:16"],
      recommendedAspectRatio: "9:16",
    },
    video: {
      allowedAspectRatios: ["9:16"],
      minDurationSeconds: 1,
      maxDurationSeconds: 600,
    },
  },
} as const;

export class PublishPlatformRuleError extends Error {
  constructor(
    public readonly code: PublishPlatformErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PublishPlatformRuleError";
  }
}

export function isPublishPlatform(value: unknown): value is PublishPlatform {
  return typeof value === "string" && (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}

export function getPublishPlatformRule(platform: unknown): PublishPlatformRule {
  if (!isPublishPlatform(platform)) {
    throw new PublishPlatformRuleError(
      PUBLISH_PLATFORM_ERROR_CODES.UNSUPPORTED,
      "不支持该发布平台"
    );
  }

  return PUBLISH_PLATFORM_RULES[platform];
}

export function listPublishPlatformRules(): PublishPlatformRule[] {
  return PUBLISH_PLATFORMS.map((platform) => PUBLISH_PLATFORM_RULES[platform]);
}
