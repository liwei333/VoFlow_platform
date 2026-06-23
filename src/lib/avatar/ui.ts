import { AvatarStatus, LicenseStatus } from "@prisma/client";
import type { SerializedAvatar } from "@/lib/avatar/serializer";
import {
  AVATAR_CONSENT_USAGE_SCOPES,
  DEFAULT_AVATAR_CONSENT_TYPE,
} from "@/lib/avatar/constants";

export type AvatarConsentUsageScope = (typeof AVATAR_CONSENT_USAGE_SCOPES)[number];

export const AVATAR_CONSENT_USAGE_SCOPE_OPTIONS: Array<{
  value: AvatarConsentUsageScope;
  label: string;
}> = [
  { value: "avatar_generation", label: "数字人生成" },
  { value: "video_generation", label: "口播视频生成" },
];

export const DEFAULT_AVATAR_CONSENT_TEXT =
  "我确认上传照片为本人肖像或已获得肖像权人合法授权，并同意将该肖像用于数字人生成和口播视频生成。";

export { DEFAULT_AVATAR_CONSENT_TYPE };

const AVATAR_STATUS_VIEWS: Record<AvatarStatus, { label: string; className: string }> = {
  draft: {
    label: "待授权",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  ready: {
    label: "可用",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  disabled: {
    label: "已停用",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  deleted: {
    label: "已删除",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
  },
};

const AVATAR_LICENSE_STATUS_VIEWS: Record<LicenseStatus, { label: string; className: string }> = {
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

export function getAvatarStatusView(status: AvatarStatus) {
  return AVATAR_STATUS_VIEWS[status];
}

export function getAvatarLicenseStatusView(status: LicenseStatus) {
  return AVATAR_LICENSE_STATUS_VIEWS[status];
}

export function getAvatarPreviewDisplay(
  avatar: Pick<SerializedAvatar, "previewUrl" | "sourceAsset">
) {
  if (avatar.previewUrl) {
    return {
      imageUrl: avatar.previewUrl,
      label: "数字人预览",
    };
  }

  return {
    imageUrl: avatar.sourceAsset.accessUrl,
    label: "源照片",
  };
}
