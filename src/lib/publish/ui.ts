import type { PublishPlatform } from "@/lib/publish/rules";
import type { PublishValidationSummary } from "@/lib/publish/validation";

export const PUBLISH_STATUS_UI: Record<
  string,
  {
    label: string;
    tone: "neutral" | "info" | "success" | "warning" | "danger";
  }
> = {
  pending: {
    label: "待发布",
    tone: "neutral",
  },
  uploading: {
    label: "上传中",
    tone: "info",
  },
  published: {
    label: "已发布",
    tone: "success",
  },
  failed: {
    label: "发布失败",
    tone: "danger",
  },
  skipped: {
    label: "已跳过",
    tone: "warning",
  },
} as const;

export const PUBLISH_ACTION_LABELS = {
  validate: "发布前检查",
  saveDrafts: "保存草稿",
  exportMp4: "仅导出 MP4",
  publishNow: "一键发布",
  retry: "重试",
  syncRemoteStatus: "刷新远端状态",
} as const;

export const PUBLISH_ERROR_ACTION_LABELS: Record<string, string> = {
  PUBLISH_REAL_PLATFORM_NOT_CONFIGURED: "检查真实发布配置",
  CHANNEL_TOKEN_EXPIRED: "重新授权",
  CHANNEL_TOKEN_REFRESH_FAILED: "重新授权",
  CHANNEL_ACCOUNT_NOT_CONNECTED: "授权账号",
  PUBLISH_UPLOAD_FAILED: "重试发布",
  PUBLISH_REMOTE_FAILED: "刷新远端状态",
  PUBLISH_STATUS_SYNC_FAILED: "刷新远端状态",
  PUBLISH_RATE_LIMITED: "稍后重试",
  PUBLISH_PLATFORM_REVIEW_REQUIRED: "查看平台审核状态",
} as const;

export function getPublishStatusLabel(status: string): string {
  return PUBLISH_STATUS_UI[status]?.label ?? status;
}

export function getPublishStatusTone(status: string): string {
  const tone = PUBLISH_STATUS_UI[status]?.tone ?? "neutral";

  switch (tone) {
    case "success":
      return "border-green-200 bg-green-50 text-green-700";
    case "danger":
      return "border-red-200 bg-red-50 text-red-700";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

export function summarizePublishValidationResults(
  results: readonly { passed: boolean }[]
): PublishValidationSummary {
  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    total,
    passed,
    failed: total - passed,
    canPublish: total > 0 && passed === total,
  };
}

export function getPublishPlatformDisplayName(
  platform: PublishPlatform,
  labels: Partial<Record<PublishPlatform, string>>
): string {
  return labels[platform] ?? platform;
}

export function summarizePublishScopes(scopes: readonly string[]): string {
  if (scopes.length === 0) {
    return "未记录 scope";
  }

  return scopes.map((scope) => scope.split("/").at(-1) ?? scope).join("、");
}

export function summarizeRemoteStatus(status: unknown): string {
  if (status === null || status === undefined) {
    return "未同步";
  }

  if (typeof status === "string") {
    return status;
  }

  if (typeof status !== "object" || Array.isArray(status)) {
    return String(status);
  }

  return Object.entries(status as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

export function getPublishErrorActionLabel(errorCode: string | null): string | null {
  if (!errorCode) {
    return null;
  }

  return PUBLISH_ERROR_ACTION_LABELS[errorCode] ?? null;
}
