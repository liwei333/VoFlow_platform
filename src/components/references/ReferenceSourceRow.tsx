"use client";

import { formatMediaDuration } from "@/lib/scripts/ui";
import {
  getReferenceFallbackMessage,
  getReferenceSourceStatusView,
} from "@/lib/references/ui";
import type { ReferenceSourceViewModel } from "@/components/references/types";

export function ReferenceSourceRow({
  source,
  retrying,
  onRetry,
}: {
  source: ReferenceSourceViewModel;
  retrying: boolean;
  onRetry: (source: ReferenceSourceViewModel) => void;
}) {
  const statusView = getReferenceSourceStatusView(source.status);
  const sourceLabel =
    source.sourceType === "asset"
      ? source.asset?.name || "素材参考"
      : source.platform
        ? `${source.platform} 链接`
        : "参考链接";
  const hasRetryTarget = source.status === "failed" && Boolean(source.assetId || source.sourceUrl);
  const structureText = source.structureJson
    ? JSON.stringify(source.structureJson, null, 2)
    : "";

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusView.className}`}
            >
              {statusView.label}
            </span>
            <span className="text-sm font-medium text-gray-900">{sourceLabel}</span>
            {source.durationMs !== null && (
              <span className="text-xs text-gray-500">
                {formatMediaDuration({ durationMs: source.durationMs })}
              </span>
            )}
          </div>
          <div className="mt-2 truncate text-xs text-gray-500">
            {source.sourceUrl || source.assetId || source.id}
          </div>
        </div>
        {hasRetryTarget && (
          <button
            type="button"
            onClick={() => onRetry(source)}
            disabled={retrying}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? "重试中..." : "重试提取"}
          </button>
        )}
      </div>

      {source.status === "failed" && (
        <div className="mt-3 rounded-md border border-rose-100 bg-white px-3 py-2 text-sm text-rose-700">
          {getReferenceFallbackMessage(source.errorJson)}
        </div>
      )}

      {source.transcript && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-500">转写文本</div>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {source.transcript}
          </p>
        </div>
      )}

      {structureText && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-500">结构结果</div>
          <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-white p-3 text-xs leading-5 text-gray-700">
            {structureText}
          </pre>
        </div>
      )}
    </div>
  );
}
