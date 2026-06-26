import type { ChannelAccountStatus } from "@prisma/client";
import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";

export const CHANNEL_ACCOUNT_DISPLAY_STATUSES = [
  "connected",
  "expired",
  "not_connected",
] as const;

export type ChannelAccountDisplayStatus =
  (typeof CHANNEL_ACCOUNT_DISPLAY_STATUSES)[number];

export const CHANNEL_ACCOUNT_STATUS_UI: Record<
  ChannelAccountDisplayStatus,
  { label: string; requiresAuth: boolean }
> = {
  connected: {
    label: "已授权",
    requiresAuth: false,
  },
  expired: {
    label: "授权已过期",
    requiresAuth: true,
  },
  not_connected: {
    label: "未授权",
    requiresAuth: true,
  },
} as const;

export interface ChannelAccountRecord {
  id: string;
  platform: PublishPlatform;
  accountName: string | null;
  status: ChannelAccountStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedChannelAccount {
  id: string | null;
  platform: PublishPlatform;
  platformLabel: string;
  status: ChannelAccountDisplayStatus;
  statusLabel: string;
  accountName: string | null;
  expiresAt: string | null;
  requiresAuth: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function serializeChannelAccount(
  platform: PublishPlatform,
  account: ChannelAccountRecord | null,
  now = new Date()
): SerializedChannelAccount {
  const rule = getPublishPlatformRule(platform);
  const status = getChannelAccountDisplayStatus(account, now);
  const ui = CHANNEL_ACCOUNT_STATUS_UI[status];

  return {
    id: account?.id ?? null,
    platform,
    platformLabel: rule.label,
    status,
    statusLabel: ui.label,
    accountName: account?.accountName ?? null,
    expiresAt: account?.expiresAt ? account.expiresAt.toISOString() : null,
    requiresAuth: ui.requiresAuth,
    createdAt: account?.createdAt ? account.createdAt.toISOString() : null,
    updatedAt: account?.updatedAt ? account.updatedAt.toISOString() : null,
  };
}

export function getChannelAccountDisplayStatus(
  account: Pick<ChannelAccountRecord, "status" | "expiresAt"> | null,
  now = new Date()
): ChannelAccountDisplayStatus {
  if (!account || account.status === "not_connected" || account.status === "revoked") {
    return "not_connected";
  }

  if (account.status === "expired") {
    return "expired";
  }

  if (account.expiresAt && account.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return "connected";
}
