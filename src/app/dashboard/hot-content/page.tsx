"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ASSET_CONSENT_TEXT,
  type AssetType,
} from "@/lib/assets/ui";
import { formatMediaDuration } from "@/lib/scripts/ui";
import {
  getReferenceFallbackMessage,
  getReferenceLinkPlatformPreview,
  getReferenceSourceStatusView,
  isReferenceSelectableMediaAsset,
  REFERENCE_UPLOAD_USAGE_SCOPE,
} from "@/lib/references/ui";
import {
  REFERENCE_PLATFORM_DEFINITIONS,
  REFERENCE_PLATFORMS,
} from "@/lib/references/platforms";
import { ReferenceSourceRow } from "@/components/references/ReferenceSourceRow";
import type {
  ReferenceMediaAssetViewModel,
  ReferenceSourceViewModel,
} from "@/components/references/types";

type Project = {
  id: string;
  name: string;
  targetPlatform: string;
  aspectRatio: string;
  status: string;
};

type WorkflowJob = {
  id: string;
  projectId: string;
  status: string;
  currentNode: string | null;
};

type UploadedAsset = {
  id: string;
  type: AssetType;
  name: string;
  fileName: string;
  metadata: unknown;
  licenseStatus: string;
};

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

const SUPPORTED_REFERENCE_PLATFORM_LABELS = REFERENCE_PLATFORMS.map(
  (platform) => REFERENCE_PLATFORM_DEFINITIONS[platform].label
).join("、");

function getAssetTypeForReferenceFile(file: File | null): AssetType | null {
  if (!file) {
    return null;
  }

  if (file.type.startsWith("audio/")) {
    return "audio";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return null;
}

export default function HotContentPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [mediaAssets, setMediaAssets] = useState<ReferenceMediaAssetViewModel[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [referenceSources, setReferenceSources] = useState<ReferenceSourceViewModel[]>([]);
  const [referenceLink, setReferenceLink] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDurationSeconds, setUploadDurationSeconds] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingMediaAssets, setLoadingMediaAssets] = useState(false);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [creatingReferenceFromUrl, setCreatingReferenceFromUrl] = useState(false);
  const [creatingReferenceFromAsset, setCreatingReferenceFromAsset] = useState(false);
  const [uploadingReferenceFile, setUploadingReferenceFile] = useState(false);
  const [retryingReferenceSourceId, setRetryingReferenceSourceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedAsset = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [mediaAssets, selectedAssetId]
  );
  const referenceLinkPreview = useMemo(
    () => getReferenceLinkPlatformPreview(referenceLink),
    [referenceLink]
  );
  const referenceStats = useMemo(
    () => ({
      total: referenceSources.length,
      succeeded: referenceSources.filter((source) => source.status === "succeeded").length,
      active: referenceSources.filter((source) => getReferenceSourceStatusView(source.status).isActive).length,
      failed: referenceSources.filter((source) => source.status === "failed").length,
    }),
    [referenceSources]
  );
  const selectedFileType = getAssetTypeForReferenceFile(selectedFile);
  const canCreateReferenceFromUrl =
    Boolean(selectedProjectId) &&
    Boolean(referenceLink.trim()) &&
    referenceLinkPreview.supported &&
    !creatingReferenceFromUrl;
  const canCreateReferenceFromAsset =
    Boolean(selectedProjectId) && Boolean(selectedAssetId) && !creatingReferenceFromAsset;
  const canUploadReferenceFile =
    Boolean(selectedProjectId) &&
    Boolean(selectedFile) &&
    Boolean(selectedFileType) &&
    Number(uploadDurationSeconds) > 0 &&
    !uploadingReferenceFile;

  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/projects");
      const body = (await response.json()) as ApiResponse<{ projects: Project[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "项目加载失败");
        return;
      }

      setProjects(body.data.projects);
      setSelectedProjectId((current) => current || body.data?.projects[0]?.id || "");
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setErrorMessage("项目加载失败");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const fetchMediaAssets = useCallback(async () => {
    setLoadingMediaAssets(true);

    try {
      const [audioResponse, videoResponse] = await Promise.all([
        fetch("/api/assets?type=audio&licenseStatus=approved&pageSize=50"),
        fetch("/api/assets?type=video&licenseStatus=approved&pageSize=50"),
      ]);
      const [audioBody, videoBody] = await Promise.all([
        audioResponse.json() as Promise<ApiResponse<{ assets: ReferenceMediaAssetViewModel[] }>>,
        videoResponse.json() as Promise<ApiResponse<{ assets: ReferenceMediaAssetViewModel[] }>>,
      ]);
      const assets = [
        ...(audioBody.code === "SUCCESS" && audioBody.data ? audioBody.data.assets : []),
        ...(videoBody.code === "SUCCESS" && videoBody.data ? videoBody.data.assets : []),
      ].filter(isReferenceSelectableMediaAsset);

      setMediaAssets(assets);
      setSelectedAssetId((current) => current || assets[0]?.id || "");
    } catch (error) {
      console.error("Failed to fetch reference media assets:", error);
      setMediaAssets([]);
    } finally {
      setLoadingMediaAssets(false);
    }
  }, []);

  const fetchProjectReferences = useCallback(async (projectId: string) => {
    if (!projectId) {
      setReferenceSources([]);
      return;
    }

    setLoadingReferences(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/references`);
      const body = (await response.json()) as ApiResponse<{ references: ReferenceSourceViewModel[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setReferenceSources([]);
        return;
      }

      setReferenceSources(body.data.references);
    } catch (error) {
      console.error("Failed to fetch project references:", error);
      setReferenceSources([]);
    } finally {
      setLoadingReferences(false);
    }
  }, []);

  const mergeReferenceSource = useCallback((nextReferenceSource: ReferenceSourceViewModel) => {
    setReferenceSources((current) => {
      const existingIndex = current.findIndex((source) => source.id === nextReferenceSource.id);
      if (existingIndex === -1) {
        return [nextReferenceSource, ...current];
      }

      return current.map((source) =>
        source.id === nextReferenceSource.id ? nextReferenceSource : source
      );
    });
  }, []);

  const fetchReferenceSource = useCallback(
    async (referenceSourceId: string) => {
      try {
        const response = await fetch(`/api/references/${referenceSourceId}`);
        const body = (await response.json()) as ApiResponse<{ referenceSource: ReferenceSourceViewModel }>;

        if (body.code === "SUCCESS" && body.data) {
          mergeReferenceSource(body.data.referenceSource);
        }
      } catch (error) {
        console.error("Failed to fetch reference source:", error);
      }
    },
    [mergeReferenceSource]
  );

  useEffect(() => {
    fetchProjects();
    fetchMediaAssets();
  }, [fetchMediaAssets, fetchProjects]);

  useEffect(() => {
    fetchProjectReferences(selectedProjectId);
  }, [fetchProjectReferences, selectedProjectId]);

  useEffect(() => {
    const activeReferenceSourceIds = referenceSources
      .filter((source) => getReferenceSourceStatusView(source.status).isActive)
      .map((source) => source.id);

    if (activeReferenceSourceIds.length === 0) {
      return;
    }

    activeReferenceSourceIds.forEach(fetchReferenceSource);
    const intervalId = window.setInterval(() => {
      activeReferenceSourceIds.forEach(fetchReferenceSource);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchReferenceSource, referenceSources]);

  async function submitReferenceFromAsset(assetId: string): Promise<boolean> {
    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return false;
    }

    if (!assetId) {
      setErrorMessage("请先选择已授权音视频素材");
      return false;
    }

    setCreatingReferenceFromAsset(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/references/from-asset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      const body = (await response.json()) as ApiResponse<{
        referenceSource: ReferenceSourceViewModel;
        job: WorkflowJob;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "参考素材提取任务创建失败");
        return false;
      }

      mergeReferenceSource(body.data.referenceSource);
      setNoticeMessage("参考素材提取任务已创建");
      await fetchProjectReferences(selectedProjectId);
      return true;
    } catch (error) {
      console.error("Failed to create reference task from asset:", error);
      setErrorMessage("参考素材提取任务创建失败");
      return false;
    } finally {
      setCreatingReferenceFromAsset(false);
    }
  }

  async function createReferenceFromAsset() {
    await submitReferenceFromAsset(selectedAssetId);
  }

  async function createReferenceFromUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = referenceLink.trim();

    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return;
    }

    if (!trimmedUrl) {
      setErrorMessage("请输入参考链接");
      return;
    }

    const preview = getReferenceLinkPlatformPreview(trimmedUrl);
    if (!preview.supported) {
      setErrorMessage(preview.message);
      return;
    }

    setCreatingReferenceFromUrl(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/references/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: trimmedUrl }),
      });
      const body = (await response.json()) as ApiResponse<{
        referenceSource?: ReferenceSourceViewModel;
        fallback?: { message?: string };
      }>;

      if (body.code !== "SUCCESS" || !body.data?.referenceSource) {
        const fallbackMessage =
          body.data?.fallback?.message ||
          (body.code === "REFERENCE_PARSE_FAILED"
            ? getReferenceFallbackMessage({ code: "REFERENCE_PARSE_FAILED" })
            : "");
        setErrorMessage([body.message || "参考链接解析失败", fallbackMessage].filter(Boolean).join(" "));
        return;
      }

      mergeReferenceSource(body.data.referenceSource);
      setReferenceLink("");
      setNoticeMessage("参考链接已解析");
      await fetchProjectReferences(selectedProjectId);
    } catch (error) {
      console.error("Failed to create reference source from URL:", error);
      setErrorMessage("参考链接解析失败，建议上传视频/音频继续提取。");
    } finally {
      setCreatingReferenceFromUrl(false);
    }
  }

  async function uploadReferenceFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return;
    }

    if (!selectedFile || !selectedFileType) {
      setErrorMessage("请上传音频或视频文件");
      return;
    }

    const durationSeconds = Number(uploadDurationSeconds);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setErrorMessage("请输入有效的音视频时长");
      return;
    }

    setUploadingReferenceFile(true);
    setErrorMessage("");
    setNoticeMessage("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("type", selectedFileType);
    formData.append("name", selectedFile.name);
    formData.append(
      "metadata",
      JSON.stringify({
        durationMs: Math.round(durationSeconds * 1000),
      })
    );

    try {
      const uploadResponse = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const uploadBody = (await uploadResponse.json()) as ApiResponse<{ asset: UploadedAsset }>;

      if (uploadBody.code !== "SUCCESS" || !uploadBody.data?.asset) {
        setErrorMessage(uploadBody.message || "参考文件上传失败");
        return;
      }

      const asset = uploadBody.data.asset;
      const consentResponse = await fetch(`/api/assets/${asset.id}/consents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentText: DEFAULT_ASSET_CONSENT_TEXT,
          usageScope: [REFERENCE_UPLOAD_USAGE_SCOPE],
        }),
      });
      const consentBody = (await consentResponse.json()) as ApiResponse<unknown>;

      if (consentBody.code !== "SUCCESS") {
        setErrorMessage(consentBody.message || "素材授权确认失败");
        return;
      }

      setSelectedFile(null);
      setUploadDurationSeconds("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await fetchMediaAssets();
      await submitReferenceFromAsset(asset.id);
    } catch (error) {
      console.error("Failed to upload reference file:", error);
      setErrorMessage("参考文件上传失败");
    } finally {
      setUploadingReferenceFile(false);
    }
  }

  async function retryReferenceSource(source: ReferenceSourceViewModel) {
    setRetryingReferenceSourceId(source.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/references/${source.id}/retry`, {
        method: "POST",
      });
      const body = (await response.json()) as ApiResponse<{
        referenceSource?: ReferenceSourceViewModel;
        fallback?: { message?: string };
      }>;

      if (body.code !== "SUCCESS" || !body.data?.referenceSource) {
        const fallbackMessage = body.data?.fallback?.message || "";
        setErrorMessage([body.message || "参考来源重试失败", fallbackMessage].filter(Boolean).join(" "));
        await fetchProjectReferences(selectedProjectId);
        return;
      }

      mergeReferenceSource(body.data.referenceSource);
      setNoticeMessage(body.message || "参考来源已重试");
      await fetchProjectReferences(selectedProjectId);
    } catch (error) {
      console.error("Failed to retry reference source:", error);
      setErrorMessage("参考来源重试失败");
    } finally {
      setRetryingReferenceSourceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">爆款提取</h1>
          <div className="mt-2 text-sm text-gray-500">
            {selectedProject ? `${selectedProject.name} / ${selectedProject.targetPlatform}` : "选择项目后导入参考内容"}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            disabled={loadingProjects}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
          >
            <option value="">{loadingProjects ? "加载项目中..." : "选择项目"}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              fetchMediaAssets();
              fetchProjectReferences(selectedProjectId);
            }}
            disabled={!selectedProjectId || loadingReferences}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingReferences ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}
      {noticeMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {noticeMessage}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCell label="参考来源" value={referenceStats.total} />
        <SummaryCell label="已完成" value={referenceStats.succeeded} />
        <SummaryCell label="处理中" value={referenceStats.active} />
        <SummaryCell label="失败" value={referenceStats.failed} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">从链接解析</h2>
              <span className="text-sm text-gray-500">{SUPPORTED_REFERENCE_PLATFORM_LABELS}</span>
            </div>
            <form onSubmit={createReferenceFromUrl} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <input
                  value={referenceLink}
                  onChange={(event) => setReferenceLink(event.target.value)}
                  placeholder="粘贴爆款视频链接"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className={referenceLinkPreview.supported ? "mt-2 text-sm text-emerald-700" : "mt-2 text-sm text-gray-500"}>
                  {referenceLinkPreview.message}
                </div>
              </div>
              <button
                type="submit"
                disabled={!canCreateReferenceFromUrl}
                className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingReferenceFromUrl ? "解析中..." : "解析参考链接"}
              </button>
            </form>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">上传视频/音频</h2>
              <span className="text-sm text-gray-500">上传后自动确认素材授权并创建提取任务</span>
            </div>
            <form onSubmit={uploadReferenceFile} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm file:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={uploadDurationSeconds}
                onChange={(event) => setUploadDurationSeconds(event.target.value)}
                placeholder="时长秒数"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!canUploadReferenceFile}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingReferenceFile ? "上传中..." : "上传并提取"}
              </button>
            </form>
            <div className="mt-3 text-sm text-gray-500">
              {selectedFile
                ? `${selectedFile.name} / ${selectedFileType ? (selectedFileType === "audio" ? "音频" : "视频") : "不支持的文件类型"}`
                : "仅支持音频或视频文件"}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">从素材提取</h2>
              <button
                type="button"
                onClick={fetchMediaAssets}
                disabled={loadingMediaAssets}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMediaAssets ? "刷新中..." : "刷新素材"}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={selectedAssetId}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                disabled={loadingMediaAssets || mediaAssets.length === 0}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value="">
                  {loadingMediaAssets ? "加载素材中..." : mediaAssets.length === 0 ? "暂无已授权音视频素材" : "选择音视频素材"}
                </option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.type === "audio" ? "音频" : "视频"} / {asset.name} / {formatMediaDuration(asset.metadata)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createReferenceFromAsset}
                disabled={!canCreateReferenceFromAsset}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingReferenceFromAsset ? "创建中..." : "提取参考结构"}
              </button>
            </div>
            <div className="mt-3 text-sm text-gray-500">
              {selectedAsset
                ? `${selectedAsset.fileName} / ${formatMediaDuration(selectedAsset.metadata)}`
                : "仅展示已授权的音频和视频素材"}
            </div>
          </section>
        </div>

        <aside className="rounded-md border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">提取产物</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            <ResultItem label="来源平台" active />
            <ResultItem label="视频时长" active />
            <ResultItem label="转写文本" active />
            <ResultItem label="钩子/节奏/卖点" active />
            <ResultItem label="失败上传兜底" active />
          </div>
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">参考来源</h2>
          <span className="text-sm text-gray-500">
            {loadingReferences ? "加载中..." : `${referenceSources.length} 条`}
          </span>
        </div>

        {referenceSources.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">
            {selectedProjectId ? "暂无参考来源" : "请先选择项目"}
          </div>
        ) : (
          <div className="space-y-3">
            {referenceSources.map((source) => (
              <ReferenceSourceRow
                key={source.id}
                source={source}
                retrying={retryingReferenceSourceId === source.id}
                onRetry={retryReferenceSource}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function ResultItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2">
      <span>{label}</span>
      <span className={active ? "text-emerald-700" : "text-gray-400"}>{active ? "已接入" : "未接入"}</span>
    </div>
  );
}
