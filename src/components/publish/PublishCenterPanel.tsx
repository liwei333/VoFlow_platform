"use client";

import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import type { SerializedPublish } from "@/lib/publish/publish";
import type { PublishPlatform } from "@/lib/publish/rules";
import {
  PUBLISH_ACTION_LABELS,
  getPublishErrorActionLabel,
  getPublishPlatformDisplayName,
  getPublishStatusLabel,
  getPublishStatusTone,
  summarizePublishScopes,
  summarizeRemoteStatus,
  summarizePublishValidationResults,
} from "@/lib/publish/ui";
import type { PublishPlatformValidationResult } from "@/lib/publish/validation";

export interface PublishCenterPanelProps {
  accounts: SerializedChannelAccount[];
  validationResults: PublishPlatformValidationResult[];
  publishes: SerializedPublish[];
  selectedPlatforms: PublishPlatform[];
  scheduleAt: string;
  checking: boolean;
  publishing: boolean;
  exportingMp4: boolean;
  retryingPublishId: string | null;
  syncingPublishId?: string | null;
  authorizingPlatform: PublishPlatform | null;
  onScheduleAtChange: (value: string) => void;
  onRefreshAccounts: () => void;
  onAuthorize: (platform: PublishPlatform) => void;
  onValidate: () => void;
  onSaveDrafts: () => void;
  onExportMp4: () => void;
  onPublish: () => void;
  onRetry: (publishId: string) => void;
  onSyncPublish?: (publishId: string) => void;
}

export function PublishCenterPanel({
  accounts,
  validationResults,
  publishes,
  selectedPlatforms,
  scheduleAt,
  checking,
  publishing,
  exportingMp4,
  retryingPublishId,
  syncingPublishId,
  authorizingPlatform,
  onScheduleAtChange,
  onRefreshAccounts,
  onAuthorize,
  onValidate,
  onSaveDrafts,
  onExportMp4,
  onPublish,
  onRetry,
  onSyncPublish,
}: PublishCenterPanelProps) {
  const platformLabels = buildPlatformLabels(accounts, validationResults);
  const validationSummary = summarizePublishValidationResults(validationResults);
  const disabledWithoutDrafts = selectedPlatforms.length === 0;

  return (
    <section className="space-y-4 rounded-md border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">发布中心操作台</h2>
          <div className="mt-1 text-sm text-gray-500">
            汇总账号授权、发布检查、导出和一键发布状态
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshAccounts}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
        >
          刷新账号
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">账号授权状态</h3>
            <span className="text-xs text-gray-500">{accounts.length} 个平台</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {accounts.length === 0 ? (
              <EmptyState text="暂无账号状态，请先加载发布草稿或刷新账号" />
            ) : (
              accounts.map((account) => (
                <div key={account.platform} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {account.platformLabel}
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500">
                        {account.accountName || "未连接账号"}
                      </div>
                    </div>
                    <StatusBadge
                      label={account.statusLabel}
                      className={
                        account.status === "connected"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : account.status === "expired"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-gray-600"
                      }
                    />
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-gray-500">
                    <span>provider: {account.provider ?? "mock"}</span>
                    {account.provider === "mock" && (
                      <span className="font-medium text-amber-700">Mock adapter</span>
                    )}
                    {account.providerAccountId && (
                      <span>providerAccountId: {account.providerAccountId}</span>
                    )}
                    <span>scope: {summarizePublishScopes(account.scopes ?? [])}</span>
                    {account.lastAuthorizedAt && (
                      <span>最近授权 {formatDate(account.lastAuthorizedAt)}</span>
                    )}
                    {account.lastRefreshAt && (
                      <span>最近刷新 {formatDate(account.lastRefreshAt)}</span>
                    )}
                    {account.lastErrorJson !== null &&
                      account.lastErrorJson !== undefined && (
                        <span className="text-red-700">
                          {readPublishErrorMessage(account.lastErrorJson)}
                        </span>
                      )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      {account.expiresAt ? `有效期至 ${formatDate(account.expiresAt)}` : "未记录有效期"}
                    </span>
                    {account.requiresAuth && (
                      <button
                        type="button"
                        onClick={() => onAuthorize(account.platform)}
                        disabled={authorizingPlatform === account.platform}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {authorizingPlatform === account.platform
                          ? "授权中..."
                          : account.status === "expired"
                            ? "重新授权"
                            : "授权"}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">发布参数检查</h3>
            <StatusBadge
              label={
                validationResults.length === 0
                  ? "未检查"
                  : validationSummary.canPublish
                    ? "全部通过"
                    : "检查未通过"
              }
              className={
                validationResults.length === 0
                  ? "border-gray-200 bg-gray-50 text-gray-600"
                  : validationSummary.canPublish
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
              }
            />
          </div>
          <div className="mt-3 text-sm text-gray-700">
            {validationResults.length === 0
              ? "点击发布前检查后展示各平台阻断原因"
              : `${validationSummary.passed} / ${validationSummary.total} 平台可发布`}
          </div>
          <div className="mt-4 space-y-3">
            {validationResults.length === 0 ? (
              <EmptyState text="暂无检查结果" />
            ) : (
              validationResults.map((result) => {
                const failedChecks = result.checks.filter((check) => !check.passed);
                return (
                  <div key={result.platform} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {getPublishPlatformDisplayName(result.platform, platformLabels)}
                      </span>
                      <StatusBadge
                        label={result.passed ? "可发布" : "阻断"}
                        className={
                          result.passed
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }
                      />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      检查时间 {formatDate(result.checkedAt)}
                    </div>
                    {failedChecks.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-red-700">
                        {failedChecks.slice(0, 3).map((check) => (
                          <li key={`${result.platform}-${check.code}`}>{check.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">发布动作</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,280px)_repeat(4,minmax(0,1fr))]">
          <label className="text-sm font-medium text-gray-700">
            定时发布
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => onScheduleAtChange(event.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900"
            />
          </label>
          <ActionButton onClick={onValidate} disabled={checking || disabledWithoutDrafts}>
            {checking ? "检查中..." : PUBLISH_ACTION_LABELS.validate}
          </ActionButton>
          <ActionButton onClick={onSaveDrafts} disabled={disabledWithoutDrafts} variant="secondary">
            {PUBLISH_ACTION_LABELS.saveDrafts}
          </ActionButton>
          <ActionButton onClick={onExportMp4} disabled={exportingMp4 || disabledWithoutDrafts} variant="secondary">
            {exportingMp4 ? "导出中..." : PUBLISH_ACTION_LABELS.exportMp4}
          </ActionButton>
          <ActionButton onClick={onPublish} disabled={publishing || disabledWithoutDrafts}>
            {publishing ? "发布中..." : PUBLISH_ACTION_LABELS.publishNow}
          </ActionButton>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">发布日志</h3>
          <span className="text-xs text-gray-500">{publishes.length} 条记录</span>
        </div>
        <div className="mt-4 space-y-3">
          {publishes.length === 0 ? (
            <EmptyState text="暂无发布日志，提交一键发布或重试后显示平台结果" />
          ) : (
            publishes.map((publish) => (
              <div key={publish.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {getPublishPlatformDisplayName(publish.platform, platformLabels)}
                      </span>
                      <StatusBadge
                        label={getPublishStatusLabel(publish.status)}
                        className={getPublishStatusTone(publish.status)}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>requestId: {publish.requestId || "-"}</span>
                      <span>remoteId: {publish.remoteId || "-"}</span>
                      <span>更新 {formatDate(publish.updatedAt)}</span>
                      <span>最近同步 {publish.lastSyncedAt ? formatDate(publish.lastSyncedAt) : "-"}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-gray-500">
                      <span>remoteStatus: {summarizeRemoteStatus(publish.remoteStatus)}</span>
                      {publish.remoteUrl && (
                        <a
                          href={publish.remoteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-blue-700 underline underline-offset-2"
                        >
                          {publish.remoteUrl}
                        </a>
                      )}
                    </div>
                    {publish.errorJson !== null && publish.errorJson !== undefined && (
                      <div className="mt-2 space-y-1 text-xs text-red-700">
                        <div>{readPublishErrorMessage(publish.errorJson)}</div>
                        {readPublishErrorCode(publish.errorJson) && (
                          <div>{readPublishErrorCode(publish.errorJson)}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    {publish.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => onRetry(publish.id)}
                        disabled={retryingPublishId === publish.id}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {retryingPublishId === publish.id
                          ? "重试中..."
                          : (getPublishErrorActionLabel(readPublishErrorCode(publish.errorJson)) ??
                            PUBLISH_ACTION_LABELS.retry)}
                      </button>
                    )}
                    {onSyncPublish && (
                      <button
                        type="button"
                        onClick={() => onSyncPublish(publish.id)}
                        disabled={syncingPublishId === publish.id}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                      >
                        {syncingPublishId === publish.id
                          ? "同步中..."
                          : PUBLISH_ACTION_LABELS.syncRemoteStatus}
                      </button>
                    )}
                    {!onSyncPublish && (
                      <span className="text-xs font-medium text-gray-500">
                        {PUBLISH_ACTION_LABELS.syncRemoteStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function buildPlatformLabels(
  accounts: readonly SerializedChannelAccount[],
  validationResults: readonly PublishPlatformValidationResult[]
): Partial<Record<PublishPlatform, string>> {
  const labels: Partial<Record<PublishPlatform, string>> = {};
  for (const account of accounts) {
    labels[account.platform] = account.platformLabel;
  }
  for (const result of validationResults) {
    labels[result.platform] = result.account.platformLabel;
  }
  return labels;
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  variant = "primary",
}: {
  children: string;
  disabled: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "primary"
          ? "h-10 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          : "h-10 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readPublishErrorMessage(errorJson: unknown): string {
  if (!errorJson) {
    return "";
  }

  if (typeof errorJson === "string") {
    return errorJson;
  }

  if (typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return String(errorJson);
  }

  const candidate = errorJson as {
    message?: unknown;
    code?: unknown;
    currentError?: { message?: unknown; code?: unknown };
  };
  if (typeof candidate.currentError?.message === "string") {
    return candidate.currentError.message;
  }
  if (typeof candidate.message === "string") {
    return candidate.message;
  }
  if (typeof candidate.currentError?.code === "string") {
    return candidate.currentError.code;
  }
  if (typeof candidate.code === "string") {
    return candidate.code;
  }

  return "发布失败，详情已记录";
}

function readPublishErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }

  const candidate = errorJson as {
    code?: unknown;
    currentError?: { code?: unknown };
  };
  if (typeof candidate.currentError?.code === "string") {
    return candidate.currentError.code;
  }
  if (typeof candidate.code === "string") {
    return candidate.code;
  }

  return null;
}
