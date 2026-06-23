import {
  isReferencePlatform,
  type ReferencePlatform,
} from "@/lib/references/platforms";

export const REFERENCE_URL_IMPORT_ERROR_CODES = {
  disabled: "REFERENCE_URL_IMPORT_DISABLED",
  platformUnsupported: "REFERENCE_URL_PLATFORM_UNSUPPORTED",
  ytdlpUnavailable: "REFERENCE_YTDLP_UNAVAILABLE",
  ytdlpTimeout: "REFERENCE_YTDLP_TIMEOUT",
  metadataInvalid: "REFERENCE_METADATA_INVALID",
  consentRequired: "REFERENCE_IMPORT_CONSENT_REQUIRED",
  audioExtractDisabled: "REFERENCE_AUDIO_EXTRACT_DISABLED",
  importNotReady: "REFERENCE_IMPORT_NOT_READY",
  enqueueFailed: "REFERENCE_URL_IMPORT_ENQUEUE_FAILED",
  subtitleUnavailable: "REFERENCE_SUBTITLE_UNAVAILABLE",
  subtitleParseFailed: "REFERENCE_SUBTITLE_PARSE_FAILED",
} as const;

export const REFERENCE_URL_IMPORT_ERROR_MESSAGES = {
  [REFERENCE_URL_IMPORT_ERROR_CODES.disabled]:
    "真实参考链接导入未启用，请上传视频/音频或粘贴文案。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported]:
    "不支持该参考链接平台，请改用上传视频/音频或粘贴文案。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpUnavailable]:
    "yt-dlp 不可用，请检查本地安装后重试或改用上传路径。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.ytdlpTimeout]:
    "参考链接解析超时，请重试或改用上传视频/音频。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.metadataInvalid]:
    "参考链接 metadata 解析失败，请改用上传视频/音频或粘贴文案。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.consentRequired]:
    "请先确认该公开链接仅用于参考分析。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled]:
    "参考链接音频提取未启用，请改用字幕或上传素材。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady]:
    "参考链接 metadata 尚未就绪，请先解析链接。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.enqueueFailed]:
    "参考链接导入任务入队失败，请稍后重试。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.subtitleUnavailable]:
    "参考链接没有可用字幕，请改用上传素材或音频提取路径。",
  [REFERENCE_URL_IMPORT_ERROR_CODES.subtitleParseFailed]:
    "参考链接字幕解析失败，请改用上传素材或音频提取路径。",
} as const;

export const REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE = "reference_analysis_only";

export const REFERENCE_LINK_IMPORT_ENV_EXAMPLES = [
  { key: "VOFLOW_REFERENCE_LINK_IMPORT_ENABLED", value: "false" },
  { key: "VOFLOW_YTDLP_BIN", value: "yt-dlp" },
  { key: "VOFLOW_YTDLP_TIMEOUT_MS", value: "60000" },
  { key: "VOFLOW_REFERENCE_MAX_DURATION_MS", value: "180000" },
  { key: "VOFLOW_REFERENCE_MAX_AUDIO_MB", value: "50" },
  { key: "VOFLOW_REFERENCE_MAX_METADATA_BYTES", value: "2097152" },
  { key: "VOFLOW_REFERENCE_MAX_SUBTITLE_BYTES", value: "5242880" },
  { key: "VOFLOW_REFERENCE_ALLOW_AUDIO_EXTRACT", value: "true" },
  { key: "VOFLOW_REFERENCE_ALLOW_FULL_VIDEO_DOWNLOAD", value: "false" },
  { key: "VOFLOW_REFERENCE_ALLOWED_PLATFORMS", value: "youtube,bilibili" },
] as const;

export type ReferenceLinkImportEnv = Record<string, string | undefined>;

export interface ReferenceLinkImportConfig {
  enabled: boolean;
  ytdlpBin: string;
  timeoutMs: number;
  maxDurationMs: number;
  maxAudioBytes: number;
  maxMetadataBytes: number;
  maxSubtitleBytes: number;
  allowAudioExtract: boolean;
  allowFullVideoDownload: boolean;
  allowedPlatforms: ReferencePlatform[];
}

const DEFAULT_REFERENCE_LINK_IMPORT_CONFIG: ReferenceLinkImportConfig = {
  enabled: false,
  ytdlpBin: "yt-dlp",
  timeoutMs: 60_000,
  maxDurationMs: 180_000,
  maxAudioBytes: 50 * 1024 * 1024,
  maxMetadataBytes: 2 * 1024 * 1024,
  maxSubtitleBytes: 5 * 1024 * 1024,
  allowAudioExtract: true,
  allowFullVideoDownload: false,
  allowedPlatforms: ["youtube", "bilibili"],
};

export function buildReferenceLinkImportConfig(
  env: ReferenceLinkImportEnv = process.env
): ReferenceLinkImportConfig {
  return {
    enabled: readBoolean(env.VOFLOW_REFERENCE_LINK_IMPORT_ENABLED, false),
    ytdlpBin: readString(env.VOFLOW_YTDLP_BIN, DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.ytdlpBin),
    timeoutMs: readPositiveInteger(
      env.VOFLOW_YTDLP_TIMEOUT_MS,
      DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.timeoutMs
    ),
    maxDurationMs: readPositiveInteger(
      env.VOFLOW_REFERENCE_MAX_DURATION_MS,
      DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.maxDurationMs
    ),
    maxAudioBytes:
      readPositiveInteger(
        env.VOFLOW_REFERENCE_MAX_AUDIO_MB,
        DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.maxAudioBytes / 1024 / 1024
      ) *
      1024 *
      1024,
    maxMetadataBytes: readPositiveInteger(
      env.VOFLOW_REFERENCE_MAX_METADATA_BYTES,
      DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.maxMetadataBytes
    ),
    maxSubtitleBytes: readPositiveInteger(
      env.VOFLOW_REFERENCE_MAX_SUBTITLE_BYTES,
      DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.maxSubtitleBytes
    ),
    allowAudioExtract: readBoolean(env.VOFLOW_REFERENCE_ALLOW_AUDIO_EXTRACT, true),
    allowFullVideoDownload: readBoolean(env.VOFLOW_REFERENCE_ALLOW_FULL_VIDEO_DOWNLOAD, false),
    allowedPlatforms: readAllowedPlatforms(env.VOFLOW_REFERENCE_ALLOWED_PLATFORMS),
  };
}

function readString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readAllowedPlatforms(value: string | undefined): ReferencePlatform[] {
  const parsed = (value || DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.allowedPlatforms.join(","))
    .split(",")
    .map((platform) => platform.trim())
    .filter(isReferencePlatform);

  return parsed.length > 0 ? Array.from(new Set(parsed)) : DEFAULT_REFERENCE_LINK_IMPORT_CONFIG.allowedPlatforms;
}
