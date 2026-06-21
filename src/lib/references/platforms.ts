export const REFERENCE_PLATFORMS = [
  "douyin",
  "kuaishou",
  "xiaohongshu",
  "wechat_channels",
  "bilibili",
  "youtube",
  "tiktok",
] as const;

export type ReferencePlatform = (typeof REFERENCE_PLATFORMS)[number];

export const REFERENCE_PLATFORM_ERROR_CODES = {
  INVALID_URL: "REFERENCE_INVALID_URL",
  UNSUPPORTED: "REFERENCE_PLATFORM_UNSUPPORTED",
} as const;

export type ReferencePlatformErrorCode =
  (typeof REFERENCE_PLATFORM_ERROR_CODES)[keyof typeof REFERENCE_PLATFORM_ERROR_CODES];

export const REFERENCE_PLATFORM_ERROR_MESSAGES: Record<ReferencePlatformErrorCode, string> = {
  [REFERENCE_PLATFORM_ERROR_CODES.INVALID_URL]: "参考链接格式不正确，请检查后重试。",
  [REFERENCE_PLATFORM_ERROR_CODES.UNSUPPORTED]: "不支持该参考链接平台，请改用上传视频/音频或粘贴文案。",
};

export interface ReferencePlatformDefinition {
  platform: ReferencePlatform;
  label: string;
  adapterKey: ReferencePlatform;
  hosts: readonly string[];
}

export interface ReferencePlatformDetection {
  platform: ReferencePlatform;
  label: string;
  adapterKey: ReferencePlatform;
  normalizedUrl: string;
  normalizedHost: string;
}

export const REFERENCE_PLATFORM_DEFINITIONS: Record<
  ReferencePlatform,
  ReferencePlatformDefinition
> = {
  douyin: {
    platform: "douyin",
    label: "抖音",
    adapterKey: "douyin",
    hosts: ["douyin.com", "v.douyin.com", "iesdouyin.com"],
  },
  kuaishou: {
    platform: "kuaishou",
    label: "快手",
    adapterKey: "kuaishou",
    hosts: ["kuaishou.com", "v.kuaishou.com", "gifshow.com", "ksurl.cn"],
  },
  xiaohongshu: {
    platform: "xiaohongshu",
    label: "小红书",
    adapterKey: "xiaohongshu",
    hosts: ["xiaohongshu.com", "xhslink.com"],
  },
  wechat_channels: {
    platform: "wechat_channels",
    label: "视频号",
    adapterKey: "wechat_channels",
    hosts: ["channels.weixin.qq.com", "weixin.qq.com"],
  },
  bilibili: {
    platform: "bilibili",
    label: "B站",
    adapterKey: "bilibili",
    hosts: ["bilibili.com", "b23.tv"],
  },
  youtube: {
    platform: "youtube",
    label: "YouTube",
    adapterKey: "youtube",
    hosts: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    adapterKey: "tiktok",
    hosts: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
  },
} as const;

export class ReferencePlatformError extends Error {
  constructor(
    public readonly code: ReferencePlatformErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ReferencePlatformError";
  }
}

export function detectReferencePlatform(input: string): ReferencePlatformDetection {
  const url = parseReferenceUrl(input);
  const normalizedHost = normalizeHost(url.hostname);
  const definition = REFERENCE_PLATFORMS.map((platform) => REFERENCE_PLATFORM_DEFINITIONS[platform])
    .find((candidate) => candidate.hosts.some((host) => isHostMatch(normalizedHost, host)));

  if (!definition) {
    throw referencePlatformError(REFERENCE_PLATFORM_ERROR_CODES.UNSUPPORTED);
  }

  return {
    platform: definition.platform,
    label: definition.label,
    adapterKey: definition.adapterKey,
    normalizedUrl: url.toString(),
    normalizedHost,
  };
}

export function getReferencePlatformDefinition(
  platform: ReferencePlatform
): ReferencePlatformDefinition {
  return REFERENCE_PLATFORM_DEFINITIONS[platform];
}

export function isReferencePlatform(value: unknown): value is ReferencePlatform {
  return (
    typeof value === "string" &&
    (REFERENCE_PLATFORMS as readonly string[]).includes(value)
  );
}

function parseReferenceUrl(input: string): URL {
  const trimmed = input.trim();

  try {
    return new URL(hasProtocol(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw referencePlatformError(REFERENCE_PLATFORM_ERROR_CODES.INVALID_URL);
  }
}

function hasProtocol(input: string): boolean {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(input);
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function isHostMatch(actualHost: string, configuredHost: string): boolean {
  const normalizedConfiguredHost = normalizeHost(configuredHost);
  return (
    actualHost === normalizedConfiguredHost ||
    actualHost.endsWith(`.${normalizedConfiguredHost}`)
  );
}

function referencePlatformError(code: ReferencePlatformErrorCode): ReferencePlatformError {
  return new ReferencePlatformError(code, REFERENCE_PLATFORM_ERROR_MESSAGES[code]);
}
