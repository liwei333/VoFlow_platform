export type AssetType =
  | "image"
  | "audio"
  | "video"
  | "subtitle"
  | "bgm"
  | "cover"
  | "avatar_source"
  | "artifact";

export type LicenseStatus = "pending" | "approved" | "rejected" | "expired";

export type AssetUsageScope = "video_generation" | "avatar_generation" | "publishing";

export const ASSET_TYPE_OPTIONS: Array<{ value: AssetType; label: string }> = [
  { value: "image", label: "图片" },
  { value: "audio", label: "音频" },
  { value: "video", label: "视频" },
  { value: "subtitle", label: "字幕" },
  { value: "bgm", label: "背景音乐" },
  { value: "cover", label: "封面" },
  { value: "avatar_source", label: "数字人源素材" },
  { value: "artifact", label: "产物" },
];

export const ASSET_USAGE_SCOPE_OPTIONS: Array<{ value: AssetUsageScope; label: string }> = [
  { value: "video_generation", label: "视频生成" },
  { value: "avatar_generation", label: "数字人生成" },
  { value: "publishing", label: "内容发布" },
];

export const DEFAULT_ASSET_CONSENT_TEXT =
  "我确认该素材的来源、肖像、声音、版权或其他必要权利已经获得合法授权，并同意将该素材用于已勾选的业务用途。";

const ASSET_TYPE_LABELS = Object.fromEntries(
  ASSET_TYPE_OPTIONS.map((option) => [option.value, option.label])
) as Record<AssetType, string>;

const LICENSE_STATUS_VIEWS: Record<LicenseStatus, { label: string; className: string }> = {
  pending: {
    label: "待授权",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  approved: {
    label: "已授权",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  rejected: {
    label: "已拒绝",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  },
  expired: {
    label: "已过期",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
};

export function getAssetTypeLabel(type: AssetType): string {
  return ASSET_TYPE_LABELS[type];
}

export function getLicenseStatusView(status: LicenseStatus) {
  return LICENSE_STATUS_VIEWS[status];
}

export function formatAssetSize(sizeBytes: string): string {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}
