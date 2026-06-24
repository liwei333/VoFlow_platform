import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import type { AvatarRenderCrop, AvatarRenderMode } from "@/lib/avatar-render/constants";

export const AVATAR_RENDER_CROP_OPTIONS: Array<{
  value: AvatarRenderCrop;
  label: string;
}> = [
  { value: "half_body", label: "半身" },
  { value: "head", label: "头像" },
];

export const AVATAR_RENDER_MODE_LABELS: Record<AvatarRenderMode, string> = {
  preview: "低清预览",
  hd: "高清渲染",
};

export const AVATAR_RENDER_ASPECT_RATIO_LABELS: Record<ApiAspectRatio, string> = {
  "9:16": "竖版 9:16",
  "16:9": "横版 16:9",
  "1:1": "方形 1:1",
};

const AVATAR_RENDER_NODE_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  queued: "排队中",
  running: "渲染中",
  succeeded: "已生成",
  failed: "失败",
  waiting_approval: "待确认预览",
  approved: "已确认",
  cancelled: "已取消",
};

export function getAvatarRenderAspectRatioLabel(value: ApiAspectRatio): string {
  return AVATAR_RENDER_ASPECT_RATIO_LABELS[value];
}

export function getAvatarRenderAspectRatioCss(value: ApiAspectRatio): string {
  if (value === "9:16") {
    return "9 / 16";
  }

  if (value === "16:9") {
    return "16 / 9";
  }

  return "1 / 1";
}

export function getAvatarRenderModeLabel(value: AvatarRenderMode): string {
  return AVATAR_RENDER_MODE_LABELS[value];
}

export function getAvatarRenderCropLabel(value: AvatarRenderCrop): string {
  return AVATAR_RENDER_CROP_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getAvatarRenderNodeStatusLabel(status: string): string {
  return AVATAR_RENDER_NODE_STATUS_LABELS[status] ?? status;
}
