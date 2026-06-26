"use client";

export type ExportStatus = "queued" | "running" | "succeeded" | "failed" | string;

export interface ExportRequestViewModel {
  id: string;
  outputProfile: "mp4_720p" | "mp4_1080p";
  status: ExportStatus;
  subtitleArtifactId: string | null;
  bgmAssetId: string | null;
  coverArtifactId: string | null;
  finalVideoArtifact: {
    id: string;
    storageUrl: string;
  } | null;
}

export interface ExportPanelProps {
  selectedJobId: string;
  subtitleSummary: string;
  latestExport: ExportRequestViewModel | null;
  creating: boolean;
  downloadingArtifactId: string | null;
  onCreateExport: (outputProfile: "mp4_720p" | "mp4_1080p") => void;
  onDownload: (artifactId: string) => void;
  onRefresh: () => void;
}

const EXPORT_STATUS_LABELS: Record<string, string> = {
  queued: "排队中",
  running: "合成中",
  succeeded: "已完成",
  failed: "失败",
};

const OUTPUT_PROFILE_LABELS: Record<"mp4_720p" | "mp4_1080p", string> = {
  mp4_720p: "MP4 720p",
  mp4_1080p: "MP4 1080p",
};

export function ExportPanel({
  selectedJobId,
  subtitleSummary,
  latestExport,
  creating,
  downloadingArtifactId,
  onCreateExport,
  onDownload,
  onRefresh,
}: ExportPanelProps) {
  const canCreate = Boolean(selectedJobId) && !creating;
  const canDownload =
    latestExport?.status === "succeeded" && Boolean(latestExport.finalVideoArtifact);

  return (
    <section className="rounded-md border border-gray-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">最终导出</h2>
          <div className="mt-1 text-sm text-gray-500">
            {latestExport
              ? `${OUTPUT_PROFILE_LABELS[latestExport.outputProfile]} / ${
                  EXPORT_STATUS_LABELS[latestExport.status] ?? latestExport.status
                }`
              : "尚未创建导出任务"}
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
        >
          刷新导出
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBlock label="字幕摘要" value={subtitleSummary || "等待字幕产物"} />
        <InfoBlock
          label="BGM"
          value={latestExport?.bgmAssetId ? "已选择 BGM" : "无 BGM"}
        />
        <InfoBlock
          label="封面"
          value={latestExport?.coverArtifactId ? "已生成封面" : "等待封面"}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onCreateExport("mp4_1080p")}
          disabled={!canCreate}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "创建中..." : "导出 1080p"}
        </button>
        <button
          type="button"
          onClick={() => onCreateExport("mp4_720p")}
          disabled={!canCreate}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          导出 720p
        </button>
        <button
          type="button"
          onClick={() => {
            if (latestExport?.finalVideoArtifact) {
              onDownload(latestExport.finalVideoArtifact.id);
            }
          }}
          disabled={!canDownload || downloadingArtifactId === latestExport?.finalVideoArtifact?.id}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloadingArtifactId === latestExport?.finalVideoArtifact?.id
            ? "生成链接中..."
            : "下载 MP4"}
        </button>
      </div>
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
