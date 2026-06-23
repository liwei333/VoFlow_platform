import { detectReferencePlatform, ReferencePlatformError } from "@/lib/references/platforms";
import { isReferenceMediaAssetType } from "@/lib/references/assets";
import type { AssetUsageScope } from "@/lib/assets/ui";

export const REFERENCE_UPLOAD_USAGE_SCOPE: AssetUsageScope = "video_generation";

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
