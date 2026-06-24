"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import type { SerializedAvatar } from "@/lib/avatar/serializer";
import { getAvatarLicenseStatusView, getAvatarStatusView } from "@/lib/avatar/ui";
import type { AvatarRenderCrop } from "@/lib/avatar-render/constants";
import {
  AVATAR_RENDER_CROP_OPTIONS,
  getAvatarRenderAspectRatioCss,
  getAvatarRenderAspectRatioLabel,
  getAvatarRenderCropLabel,
  getAvatarRenderModeLabel,
  getAvatarRenderNodeStatusLabel,
} from "@/lib/avatar-render/ui";
import type { TtsResultViewModel } from "@/components/tts/TtsResultPanel";

export type AvatarRenderAvatarViewModel = Pick<
  SerializedAvatar,
  "id" | "name" | "status" | "licenseStatus" | "previewUrl" | "isDefault"
>;

export type AvatarRenderResultViewModel = {
  id: string;
  jobId: string;
  nodeId: string;
  avatarId: string;
  audioArtifactId: string;
  mode: "preview" | "hd";
  aspectRatio: ApiAspectRatio;
  crop: AvatarRenderCrop;
  provider: string;
  providerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
    output: unknown;
    error: unknown;
  };
  avatar: {
    id: string;
    name: string;
    previewUrl: string | null;
  };
  videoArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    accessUrl: string;
    metadata: unknown;
    createdAt: string;
  } | null;
};

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

export function AvatarRenderPanel({
  jobId,
  projectAspectRatio,
  ttsResults,
  initialAvatars = [],
  initialResults = [],
  onError,
  onNotice,
}: {
  jobId: string;
  projectAspectRatio: ApiAspectRatio;
  ttsResults: TtsResultViewModel[];
  initialAvatars?: AvatarRenderAvatarViewModel[];
  initialResults?: AvatarRenderResultViewModel[];
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const approvedAudioResults = useMemo(
    () =>
      ttsResults.filter(
        (result) =>
          result.audioArtifact &&
          (result.status === "approved" || result.node?.status === "approved")
      ),
    [ttsResults]
  );
  const [avatars, setAvatars] = useState<AvatarRenderAvatarViewModel[]>(initialAvatars);
  const [results, setResults] = useState<AvatarRenderResultViewModel[]>(initialResults);
  const [selectedAvatarId, setSelectedAvatarId] = useState(initialAvatars[0]?.id ?? "");
  const [selectedAudioArtifactId, setSelectedAudioArtifactId] = useState(
    approvedAudioResults[0]?.audioArtifact?.id ?? ""
  );
  const [selectedCrop, setSelectedCrop] = useState<AvatarRenderCrop>("half_body");
  const [loadingAvatars, setLoadingAvatars] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [creatingPreview, setCreatingPreview] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  const selectedAvatar = useMemo(
    () => avatars.find((avatar) => avatar.id === selectedAvatarId) ?? null,
    [avatars, selectedAvatarId]
  );
  const selectedAudioResult = useMemo(
    () =>
      approvedAudioResults.find(
        (result) => result.audioArtifact?.id === selectedAudioArtifactId
      ) ?? null,
    [approvedAudioResults, selectedAudioArtifactId]
  );
  const canCreatePreview =
    Boolean(jobId) &&
    Boolean(selectedAvatarId) &&
    Boolean(selectedAudioArtifactId) &&
    !creatingPreview;

  const fetchAvatars = useCallback(async () => {
    setLoadingAvatars(true);
    try {
      const response = await fetch("/api/avatars");
      const body = (await response.json()) as ApiResponse<{
        avatars: AvatarRenderAvatarViewModel[];
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setAvatars([]);
        onError(body.message || "数字人列表加载失败");
        return;
      }

      setAvatars(body.data.avatars);
      setSelectedAvatarId((current) =>
        body.data?.avatars.some((avatar) => avatar.id === current)
          ? current
          : body.data?.avatars[0]?.id ?? ""
      );
    } catch (error) {
      console.error("Failed to fetch avatars for render:", error);
      setAvatars([]);
      onError("数字人列表加载失败");
    } finally {
      setLoadingAvatars(false);
    }
  }, [onError]);

  const fetchRenderResults = useCallback(async () => {
    if (!jobId) {
      setResults([]);
      return;
    }

    setLoadingResults(true);
    try {
      const response = await fetch(`/api/video-jobs/${jobId}/avatar-render`);
      const body = (await response.json()) as ApiResponse<{
        results: AvatarRenderResultViewModel[];
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setResults([]);
        onError(body.message || "数字人渲染结果加载失败");
        return;
      }

      setResults(body.data.results);
    } catch (error) {
      console.error("Failed to fetch avatar render results:", error);
      setResults([]);
      onError("数字人渲染结果加载失败");
    } finally {
      setLoadingResults(false);
    }
  }, [jobId, onError]);

  useEffect(() => {
    fetchAvatars();
  }, [fetchAvatars]);

  useEffect(() => {
    fetchRenderResults();
  }, [fetchRenderResults]);

  useEffect(() => {
    setSelectedAudioArtifactId((current) =>
      approvedAudioResults.some((result) => result.audioArtifact?.id === current)
        ? current
        : approvedAudioResults[0]?.audioArtifact?.id ?? ""
    );
  }, [approvedAudioResults]);

  async function createPreview() {
    if (!canCreatePreview) {
      onError("请选择可用数字人和已确认语音");
      return;
    }

    setCreatingPreview(true);
    try {
      const response = await fetch(`/api/video-jobs/${jobId}/avatar-render/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId: selectedAvatarId,
          audioArtifactId: selectedAudioArtifactId,
          aspectRatio: projectAspectRatio,
          crop: selectedCrop,
        }),
      });
      const body = (await response.json()) as ApiResponse<unknown>;

      if (body.code !== "SUCCESS") {
        onError(body.message || "预览渲染任务创建失败");
        return;
      }

      onNotice("预览渲染任务已创建");
      await fetchRenderResults();
    } catch (error) {
      console.error("Failed to create avatar render preview:", error);
      onError("预览渲染任务创建失败");
    } finally {
      setCreatingPreview(false);
    }
  }

  async function runPreviewAction(
    request: AvatarRenderResultViewModel,
    action: "confirm" | "retry"
  ) {
    setActingRequestId(request.id);
    try {
      const response = await fetch(
        `/api/video-jobs/${jobId}/avatar-render/preview/${request.id}/${action}`,
        { method: "POST" }
      );
      const body = (await response.json()) as ApiResponse<unknown>;

      if (body.code !== "SUCCESS") {
        onError(body.message || "预览操作失败");
        return;
      }

      onNotice(action === "confirm" ? "预览已确认，高清渲染任务已创建" : "预览渲染已重新创建");
      await fetchRenderResults();
    } catch (error) {
      console.error("Failed to update avatar render preview:", error);
      onError("预览操作失败");
    } finally {
      setActingRequestId(null);
    }
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">数字人渲染</h2>
          <div className="mt-1 text-sm text-gray-500">
            选择数字人和已确认语音，先生成低清预览再确认高清渲染
          </div>
        </div>
        <button
          type="button"
          onClick={fetchRenderResults}
          disabled={loadingResults || !jobId}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingResults ? "刷新中..." : "刷新渲染结果"}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-gray-700">我的数字人</div>
            {avatars.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                {loadingAvatars ? "加载数字人中..." : "暂无可用数字人"}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {avatars.map((avatar) => {
                  const selected = selectedAvatarId === avatar.id;
                  return (
                    <button
                      type="button"
                      key={avatar.id}
                      onClick={() => setSelectedAvatarId(avatar.id)}
                      className={`rounded-md border p-4 text-left ${
                        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {avatar.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar.previewUrl}
                            alt={avatar.name}
                            className="h-16 w-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-16 w-12 rounded-md bg-gray-200" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{avatar.name}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            {avatar.isDefault ? "默认数字人" : "可选数字人"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                              {getAvatarStatusView(avatar.status).label}
                            </span>
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                              {getAvatarLicenseStatusView(avatar.licenseStatus).label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="block text-sm font-medium text-gray-700">
            已确认语音
            <select
              value={selectedAudioArtifactId}
              onChange={(event) => setSelectedAudioArtifactId(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择已确认 TTS 音频</option>
              {approvedAudioResults.map((result) => (
                <option key={result.id} value={result.audioArtifact?.id}>
                  {result.voice.name} / {result.scriptCandidate.contentPreview.slice(0, 24)}
                </option>
              ))}
            </select>
          </label>

          {selectedAudioResult?.audioArtifact?.accessUrl && (
            <audio className="w-full" src={selectedAudioResult.audioArtifact.accessUrl} controls />
          )}
        </div>

        <aside className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900">渲染参数</h3>
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
              <div className="text-xs text-gray-500">画面比例</div>
              <div className="mt-1 font-medium text-gray-900">
                {getAvatarRenderAspectRatioLabel(projectAspectRatio)}
              </div>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-gray-700">人物裁剪</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {AVATAR_RENDER_CROP_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center justify-center rounded-md border px-3 py-2 text-sm ${
                      selectedCrop === option.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="avatar-render-crop"
                      value={option.value}
                      checked={selectedCrop === option.value}
                      onChange={() => setSelectedCrop(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <RenderSummaryCell label="数字人" value={selectedAvatar?.name ?? "未选择"} />
              <RenderSummaryCell
                label="裁剪"
                value={getAvatarRenderCropLabel(selectedCrop)}
              />
            </div>

            <button
              type="button"
              onClick={createPreview}
              disabled={!canCreatePreview}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingPreview ? "创建中..." : "生成低清预览"}
            </button>
          </div>
        </aside>
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">渲染结果</h3>
          <span className="text-xs text-gray-500">{results.length} 个版本</span>
        </div>
        {results.length === 0 ? (
          <div className="rounded-md border border-gray-200 px-5 py-10 text-center text-sm text-gray-500">
            暂无数字人渲染结果
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <article key={result.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {getAvatarRenderModeLabel(result.mode)}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        {getAvatarRenderNodeStatusLabel(result.node.status)}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {result.avatar.name}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {getAvatarRenderAspectRatioLabel(result.aspectRatio)} /{" "}
                      {getAvatarRenderCropLabel(result.crop)} / {result.provider}
                    </div>
                  </div>
                  {result.mode === "preview" && result.node.status === "waiting_approval" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => runPreviewAction(result, "retry")}
                        disabled={actingRequestId === result.id}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingRequestId === result.id ? "处理中..." : "重新预览"}
                      </button>
                      <button
                        type="button"
                        onClick={() => runPreviewAction(result, "confirm")}
                        disabled={actingRequestId === result.id}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actingRequestId === result.id ? "确认中..." : "确认预览"}
                      </button>
                    </div>
                  )}
                </div>

                {result.videoArtifact?.accessUrl ? (
                  <video
                    className="mt-4 w-full rounded-md bg-black"
                    src={result.videoArtifact.accessUrl}
                    style={{ aspectRatio: getAvatarRenderAspectRatioCss(result.aspectRatio) }}
                    controls
                  />
                ) : (
                  <div className="mt-4 rounded-md border border-amber-100 bg-white px-3 py-2 text-sm text-amber-700">
                    视频产物生成后可预览
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RenderSummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
  );
}
