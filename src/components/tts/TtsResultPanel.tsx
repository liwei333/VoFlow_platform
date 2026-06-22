"use client";

import { formatMediaDuration } from "@/lib/scripts/ui";

export type TtsResultViewModel = {
  id: string;
  jobId: string;
  status: string;
  speed: number;
  pitch: number;
  pauseJson: unknown;
  provider: string;
  providerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
  } | null;
  voice: {
    id: string;
    name: string;
    provider: string;
    modelId: string;
  };
  scriptCandidate: {
    id: string;
    contentPreview: string;
  };
  audioArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    accessUrl: string;
    metadata: unknown;
    createdAt: string;
  } | null;
};

export function TtsResultPanel({
  selectedVoiceLabel,
  results,
  approvingNodeId,
  regenerating,
  onRefresh,
  onConfirm,
  onRegenerate,
}: {
  selectedVoiceLabel: string;
  results: TtsResultViewModel[];
  approvingNodeId: string | null;
  regenerating: boolean;
  onRefresh: () => void;
  onConfirm: (result: TtsResultViewModel) => void;
  onRegenerate: (result: TtsResultViewModel) => void;
}) {
  return (
    <section className="rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">语音结果</h2>
          <div className="mt-1 text-sm text-gray-500">{selectedVoiceLabel}</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          刷新结果
        </button>
      </div>

      {results.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-5 py-12 text-center text-sm text-gray-500">
          暂无生成结果
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <div key={result.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                      v{result.node?.version ?? "-"} / {getTtsResultStatusLabel(result.status)}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {result.voice.name}
                    </span>
                    {result.audioArtifact && (
                      <span className="text-xs text-gray-500">
                        {formatMediaDuration(result.audioArtifact.metadata)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm leading-6 text-gray-700">
                    {result.scriptCandidate.contentPreview}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRegenerate(result)}
                    disabled={regenerating}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {regenerating ? "重新生成中..." : "重新生成"}
                  </button>
                  {result.node?.status === "waiting_approval" && (
                    <button
                      type="button"
                      onClick={() => onConfirm(result)}
                      disabled={approvingNodeId === result.node.id}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {approvingNodeId === result.node.id ? "确认中..." : "确认语音"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-4">
                <ResultCell label="请求" value={result.id.slice(0, 8)} />
                <ResultCell label="语速" value={result.speed.toString()} />
                <ResultCell label="音调" value={result.pitch.toString()} />
                <ResultCell label="Provider" value={result.provider} />
              </div>

              {result.audioArtifact?.accessUrl ? (
                <audio className="mt-4 w-full" src={result.audioArtifact.accessUrl} controls />
              ) : (
                <div className="mt-4 rounded-md border border-amber-100 bg-white px-3 py-2 text-sm text-amber-700">
                  音频文件生成后可试听
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
  );
}

function getTtsResultStatusLabel(status: string): string {
  if (status === "waiting_approval") {
    return "待确认";
  }

  if (status === "failed") {
    return "失败";
  }

  if (status === "processing") {
    return "生成中";
  }

  if (status === "approved") {
    return "已确认";
  }

  return status;
}
