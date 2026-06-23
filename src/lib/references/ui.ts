import { detectReferencePlatform, ReferencePlatformError } from "@/lib/references/platforms";
import { isReferenceMediaAssetType } from "@/lib/references/assets";
import type { AssetUsageScope } from "@/lib/assets/ui";
import {
  REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
  REFERENCE_URL_IMPORT_ERROR_MESSAGES,
} from "@/lib/references/url-import/config";
import { selectPreferredSubtitleTrack } from "@/lib/references/url-import/subtitle";

export const REFERENCE_UPLOAD_USAGE_SCOPE: AssetUsageScope = "video_generation";

const REFERENCE_ANALYSIS_ONLY_DISPLAY = REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE.replace(/_/g, "-");

export const REFERENCE_URL_IMPORT_CONSENT_TEXT_VERSION = "reference-url-import-consent-v1";
export const REFERENCE_URL_IMPORT_CONSENT_TEXT =
  `我确认该公开链接仅用于 ${REFERENCE_ANALYSIS_ONLY_DISPLAY} 参考分析，不用于声音克隆、数字人生成、发布或其他生成用途。`;
export const REFERENCE_URL_IMPORT_BOUNDARY_TEXT =
  "参考链接导入只做 metadata、字幕或授权后音频参考分析，不是下载器，不提供完整视频下载、cookie/登录态导入、去水印或批量采集。";

export type ReferenceUrlImportMode = "metadata_only" | "subtitle_only" | "audio_extract";

export interface ReferenceUrlImportUiState {
  title: string;
  platformLabel: string;
  durationMs: number | null;
  thumbnailUrl: string | null;
  subtitleAvailabilityLabel: string;
  subtitleTrackLabel: string | null;
  recommendedImportMode: ReferenceUrlImportMode;
  recommendedImportModeLabel: string;
  requiresConsent: boolean;
  canImport: boolean;
  fallbackText: string | null;
  consentText: string;
  consentTextVersion: string;
  boundaryText: string;
}

export type ReferenceSourceStatus =
  | "pending"
  | "parsing"
  | "metadata_ready"
  | "transcribing"
  | "analyzing"
  | "succeeded"
  | "failed";

export interface ReferenceStatusView {
  label: string;
  className: string;
  isActive: boolean;
}

const REFERENCE_STATUS_VIEWS: Record<ReferenceSourceStatus, ReferenceStatusView> = {
  pending: {
    label: "待处理",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    isActive: true,
  },
  parsing: {
    label: "解析中",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    isActive: true,
  },
  metadata_ready: {
    label: "待确认",
    className: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    isActive: false,
  },
  transcribing: {
    label: "转写中",
    className: "bg-blue-50 text-blue-700 ring-blue-200",
    isActive: true,
  },
  analyzing: {
    label: "分析中",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    isActive: true,
  },
  succeeded: {
    label: "已完成",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    isActive: false,
  },
  failed: {
    label: "失败",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    isActive: false,
  },
};

export function getReferenceSourceStatusView(status: string): ReferenceStatusView {
  if (isReferenceSourceStatus(status)) {
    return REFERENCE_STATUS_VIEWS[status];
  }

  return REFERENCE_STATUS_VIEWS.pending;
}

export function getReferenceLinkPlatformPreview(input: string):
  | {
      supported: true;
      platform: string;
      label: string;
      message: string;
    }
  | {
      supported: false;
      message: string;
    } {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      supported: false,
      message: "请输入参考链接",
    };
  }

  try {
    const detected = detectReferencePlatform(trimmed);
    return {
      supported: true,
      platform: detected.platform,
      label: detected.label,
      message: `已识别为${detected.label}链接`,
    };
  } catch (error) {
    if (error instanceof ReferencePlatformError) {
      return {
        supported: false,
        message: error.message,
      };
    }

    return {
      supported: false,
      message: "参考链接格式不正确，请检查后重试。",
    };
  }
}

export function isReferenceSelectableMediaAsset(asset: {
  type: string;
  licenseStatus: string;
}): boolean {
  return asset.licenseStatus === "approved" && isReferenceMediaAssetType(asset.type);
}

export function getReferenceFallbackMessage(errorJson: unknown): string {
  const code = getErrorCode(errorJson);

  if (code && Object.prototype.hasOwnProperty.call(REFERENCE_URL_IMPORT_ERROR_MESSAGES, code)) {
    return REFERENCE_URL_IMPORT_ERROR_MESSAGES[
      code as keyof typeof REFERENCE_URL_IMPORT_ERROR_MESSAGES
    ];
  }

  if (code === "REFERENCE_PARSE_FAILED") {
    return "链接解析失败，建议上传视频/音频继续提取。";
  }

  if (code === "REFERENCE_ASR_FAILED") {
    return "音视频转写失败，请检查素材后重试。";
  }

  if (code === "REFERENCE_STRUCTURE_FAILED") {
    return "结构分析失败，请重试参考提取。";
  }

  return "参考提取失败，请重试或改用上传视频/音频。";
}

export function getReferenceUrlImportUiState(source: {
  status: string;
  title?: string | null;
  platform?: string | null;
  durationMs?: number | null;
  thumbnailUrl?: string | null;
  subtitleJson?: unknown;
  errorJson?: unknown;
}): ReferenceUrlImportUiState {
  const subtitleTrack = selectPreferredSubtitleTrack(source.subtitleJson);
  const hasSubtitles = Boolean(subtitleTrack);
  const recommendedImportMode = getRecommendedReferenceUrlImportMode(source.status, hasSubtitles);
  const fallbackText = getReferenceUrlImportFallbackText(source, hasSubtitles);

  return {
    title: source.title?.trim() || "未命名参考链接",
    platformLabel: source.platform || "公开链接",
    durationMs: source.durationMs ?? null,
    thumbnailUrl: source.thumbnailUrl || null,
    subtitleAvailabilityLabel: hasSubtitles ? "有可用字幕" : "未发现字幕",
    subtitleTrackLabel: subtitleTrack
      ? `${subtitleTrack.kind === "subtitles" ? "人工字幕" : "自动字幕"} ${subtitleTrack.language.toUpperCase()} ${subtitleTrack.ext.toUpperCase()}`
      : null,
    recommendedImportMode,
    recommendedImportModeLabel: getReferenceUrlImportModeLabel(recommendedImportMode),
    requiresConsent: recommendedImportMode !== "metadata_only",
    canImport: source.status === "metadata_ready",
    fallbackText,
    consentText: REFERENCE_URL_IMPORT_CONSENT_TEXT,
    consentTextVersion: REFERENCE_URL_IMPORT_CONSENT_TEXT_VERSION,
    boundaryText: REFERENCE_URL_IMPORT_BOUNDARY_TEXT,
  };
}

function isReferenceSourceStatus(status: string): status is ReferenceSourceStatus {
  return Object.prototype.hasOwnProperty.call(REFERENCE_STATUS_VIEWS, status);
}

function getErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }

  const code = (errorJson as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getRecommendedReferenceUrlImportMode(
  status: string,
  hasSubtitles: boolean
): ReferenceUrlImportMode {
  if (status !== "metadata_ready") {
    return "metadata_only";
  }

  return hasSubtitles ? "subtitle_only" : "audio_extract";
}

function getReferenceUrlImportModeLabel(importMode: ReferenceUrlImportMode): string {
  if (importMode === "subtitle_only") {
    return "优先导入字幕";
  }

  if (importMode === "audio_extract") {
    return "授权后提取音频";
  }

  return "仅保存 metadata";
}

function getReferenceUrlImportFallbackText(
  source: { status: string; errorJson?: unknown },
  hasSubtitles: boolean
): string | null {
  if (source.status === "failed") {
    return getReferenceFallbackMessage(source.errorJson);
  }

  if (source.status === "metadata_ready" && !hasSubtitles) {
    return "未发现可用字幕，可授权仅提取音频用于参考分析，或改用上传素材。";
  }

  return null;
}
