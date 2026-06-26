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
  provider?: string | null;
  providerAccountId?: string | null;
  accountName: string | null;
  status: ChannelAccountStatus;
  expiresAt: Date | null;
  scopesJson?: unknown;
  metadataJson?: unknown;
  lastAuthorizedAt?: Date | null;
  lastRefreshAt?: Date | null;
  lastErrorJson?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedChannelAccount {
  id: string | null;
  platform: PublishPlatform;
  platformLabel: string;
  provider: string | null;
  providerAccountId: string | null;
  status: ChannelAccountDisplayStatus;
  statusLabel: string;
  accountName: string | null;
  scopes: string[];
  metadata: unknown;
  expiresAt: string | null;
  lastAuthorizedAt: string | null;
  lastRefreshAt: string | null;
  lastErrorJson: unknown;
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
    provider: account?.provider ?? null,
    providerAccountId: account?.providerAccountId ?? null,
    status,
    statusLabel: ui.label,
    accountName: account?.accountName ?? null,
    scopes: readStringArray(account?.scopesJson),
    metadata: account?.metadataJson ?? null,
    expiresAt: account?.expiresAt ? account.expiresAt.toISOString() : null,
    lastAuthorizedAt: account?.lastAuthorizedAt
      ? account.lastAuthorizedAt.toISOString()
      : null,
    lastRefreshAt: account?.lastRefreshAt ? account.lastRefreshAt.toISOString() : null,
    lastErrorJson: account?.lastErrorJson ?? null,
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

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
