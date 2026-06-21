"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { LocalModelServiceStatus, LocalModelServiceType } from "@/lib/local-model/config";
import {
  formatCheckedAt,
  getLocalModelStatusView,
  getLocalModelTypeLabel,
} from "@/lib/local-model/ui";
import {
  SCRIPT_MAX_LENGTH,
  extractRiskSummary,
  formatAsrSegmentsSummary,
  formatEstimatedSpeechDuration,
  formatMediaDuration,
  getCandidateStatusView,
  normalizeTitleCandidates,
} from "@/lib/scripts/ui";
import {
  getReferenceFallbackMessage,
  getReferenceLinkPlatformPreview,
  getReferenceSourceStatusView,
  isReferenceSelectableMediaAsset,
} from "@/lib/references/ui";
import { ReferenceSourceRow } from "@/components/references/ReferenceSourceRow";
import type { ReferenceSourceViewModel as ReferenceSource } from "@/components/references/types";

type Project = {
  id: string;
  name: string;
  targetPlatform: string;
  aspectRatio: string;
  status: string;
};

type ScriptCandidate = {
  id: string;
  scriptId: string;
  content: string;
  titleCandidates: unknown;
  riskReport: unknown;
  modelName: string | null;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AsrSegment = {
  id: string;
  scriptId: string;
  startMs: number;
  endMs: number;
  text: string;
  createdAt: string;
};

type ScriptRecord = {
  id: string;
  projectId: string;
  jobId: string | null;
  sourceType: string;
  content: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  candidates: ScriptCandidate[];
  asrSegments: AsrSegment[];
};

type MediaAsset = {
  id: string;
  type: "audio" | "video" | string;
  name: string;
  fileName: string;
  metadata: unknown;
  licenseStatus: string;
  createdAt: string;
};

type WorkflowJob = {
  id: string;
  projectId: string;
  status: string;
  currentNode: string | null;
  progress: number;
};

type LocalModelService = {
  serviceType: LocalModelServiceType;
  name: string;
  baseUrl: string | null;
  modelName: string | null;
  status: LocalModelServiceStatus;
  checkedAt: string | null;
};

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ScriptsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [referenceSources, setReferenceSources] = useState<ReferenceSource[]>([]);
  const [services, setServices] = useState<LocalModelService[]>([]);
  const [content, setContent] = useState("");
  const [referenceLink, setReferenceLink] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingMediaAssets, setLoadingMediaAssets] = useState(false);
  const [creatingTranscription, setCreatingTranscription] = useState(false);
  const [creatingReferenceFromAsset, setCreatingReferenceFromAsset] = useState(false);
  const [creatingReferenceFromUrl, setCreatingReferenceFromUrl] = useState(false);
  const [retryingReferenceSourceId, setRetryingReferenceSourceId] = useState<string | null>(null);
  const [approvingCandidateId, setApprovingCandidateId] = useState<string | null>(null);
  const [riskConfirmations, setRiskConfirmations] = useState<Record<string, boolean>>({});
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const scriptStats = useMemo(() => {
    const candidates = scripts.flatMap((script) => script.candidates);
    return {
      scripts: scripts.length,
      candidates: candidates.length,
      approved: candidates.filter((candidate) => candidate.status === "approved").length,
      risk: candidates.filter((candidate) => extractRiskSummary(candidate.riskReport).requiresApproval).length,
    };
  }, [scripts]);
  const llmService = services.find((service) => service.serviceType === "llm") ?? null;
  const asrService = services.find((service) => service.serviceType === "asr") ?? null;
  const selectedAsset = mediaAssets.find((asset) => asset.id === selectedAssetId) ?? null;
  const referenceLinkPreview = useMemo(
    () => getReferenceLinkPlatformPreview(referenceLink),
    [referenceLink]
  );
  const canSave = content.trim().length > 0 && content.trim().length <= SCRIPT_MAX_LENGTH && Boolean(selectedProjectId) && !saving;
  const canCreateTranscription = Boolean(selectedProjectId) && Boolean(selectedAssetId) && !creatingTranscription;
  const canCreateReferenceFromAsset =
    Boolean(selectedProjectId) && Boolean(selectedAssetId) && !creatingReferenceFromAsset;
  const canCreateReferenceFromUrl =
    Boolean(selectedProjectId) &&
    Boolean(referenceLink.trim()) &&
    referenceLinkPreview.supported &&
    !creatingReferenceFromUrl;

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

  const fetchLocalModelServices = useCallback(async () => {
    try {
      const response = await fetch("/api/local-model-services");
      const body = (await response.json()) as ApiResponse<{ services: LocalModelService[] }>;

      if (body.code === "SUCCESS" && body.data) {
        setServices(body.data.services);
      }
    } catch (error) {
      console.error("Failed to fetch local model services:", error);
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
        audioResponse.json() as Promise<ApiResponse<{ assets: MediaAsset[] }>>,
        videoResponse.json() as Promise<ApiResponse<{ assets: MediaAsset[] }>>,
      ]);
      const assets = [
        ...(audioBody.code === "SUCCESS" && audioBody.data ? audioBody.data.assets : []),
        ...(videoBody.code === "SUCCESS" && videoBody.data ? videoBody.data.assets : []),
      ].filter(isReferenceSelectableMediaAsset);

      setMediaAssets(assets);
      setSelectedAssetId((current) => current || assets[0]?.id || "");
    } catch (error) {
      console.error("Failed to fetch transcription media assets:", error);
      setMediaAssets([]);
    } finally {
      setLoadingMediaAssets(false);
    }
  }, []);

  const fetchProjectScripts = useCallback(async (projectId: string) => {
    if (!projectId) {
      setScripts([]);
      return;
    }

    setLoadingScripts(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`);
      const body = (await response.json()) as ApiResponse<{ scripts: ScriptRecord[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "文案加载失败");
        return;
      }

      setScripts(body.data.scripts);
    } catch (error) {
      console.error("Failed to fetch scripts:", error);
      setErrorMessage("文案加载失败");
    } finally {
      setLoadingScripts(false);
    }
  }, []);

  const fetchProjectJobs = useCallback(async (projectId: string) => {
    if (!projectId) {
      setJobs([]);
      setSelectedJobId("");
      return;
    }

    try {
      const response = await fetch(`/api/video-jobs?projectId=${projectId}&pageSize=50`);
      const body = (await response.json()) as ApiResponse<{ jobs: WorkflowJob[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setJobs([]);
        return;
      }

      setJobs(body.data.jobs);
      setSelectedJobId((current) => current || body.data?.jobs[0]?.id || "");
    } catch (error) {
      console.error("Failed to fetch video jobs:", error);
      setJobs([]);
    }
  }, []);

  const fetchProjectReferences = useCallback(async (projectId: string) => {
    if (!projectId) {
      setReferenceSources([]);
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/references`);
      const body = (await response.json()) as ApiResponse<{ references: ReferenceSource[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setReferenceSources([]);
        return;
      }

      setReferenceSources(body.data.references);
    } catch (error) {
      console.error("Failed to fetch project references:", error);
      setReferenceSources([]);
    }
  }, []);

  const mergeReferenceSource = useCallback((nextReferenceSource: ReferenceSource) => {
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
        const body = (await response.json()) as ApiResponse<{ referenceSource: ReferenceSource }>;

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
    fetchLocalModelServices();
    fetchMediaAssets();
  }, [fetchLocalModelServices, fetchMediaAssets, fetchProjects]);

  useEffect(() => {
    fetchProjectScripts(selectedProjectId);
    fetchProjectJobs(selectedProjectId);
    fetchProjectReferences(selectedProjectId);
    setRiskConfirmations({});
  }, [fetchProjectJobs, fetchProjectReferences, fetchProjectScripts, selectedProjectId]);

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

  async function handleSaveScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedContent = content.trim();

    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return;
    }

    if (!trimmedContent) {
      setErrorMessage("文案不能为空");
      return;
    }

    if (trimmedContent.length > SCRIPT_MAX_LENGTH) {
      setErrorMessage("文案超过 3000 字限制");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmedContent }),
      });
      const body = (await response.json()) as ApiResponse<{ script: ScriptRecord }>;

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "文案保存失败");
        return;
      }

      setContent("");
      setNoticeMessage("文案已保存");
      await fetchProjectScripts(selectedProjectId);
    } catch (error) {
      console.error("Failed to save script:", error);
      setErrorMessage("文案保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function createTranscriptionTask() {
    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return;
    }

    if (!selectedAssetId) {
      setErrorMessage("请先选择已授权音视频素材");
      return;
    }

    setCreatingTranscription(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/projects/${selectedProjectId}/scripts/from-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selectedAssetId }),
      });
      const body = (await response.json()) as ApiResponse<{
        job: WorkflowJob;
        node: { id: string; nodeType: string; status: string };
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "转写任务创建失败");
        return;
      }

      setSelectedJobId(body.data.job.id);
      setNoticeMessage("转写任务已创建");
      await fetchProjectJobs(selectedProjectId);
      await fetchProjectScripts(selectedProjectId);
    } catch (error) {
      console.error("Failed to create transcription task:", error);
      setErrorMessage("转写任务创建失败");
    } finally {
      setCreatingTranscription(false);
    }
  }

  async function createReferenceFromAsset(assetId = selectedAssetId) {
    if (!selectedProjectId) {
      setErrorMessage("请先选择项目");
      return;
    }

    if (!assetId) {
      setErrorMessage("请先选择已授权音视频素材");
      return;
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
        referenceSource: ReferenceSource;
        job: WorkflowJob;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "参考素材提取任务创建失败");
        return;
      }

      mergeReferenceSource(body.data.referenceSource);
      setSelectedJobId(body.data.job.id);
      setNoticeMessage("参考素材提取任务已创建");
      await fetchProjectJobs(selectedProjectId);
      await fetchProjectReferences(selectedProjectId);
    } catch (error) {
      console.error("Failed to create reference task from asset:", error);
      setErrorMessage("参考素材提取任务创建失败");
    } finally {
      setCreatingReferenceFromAsset(false);
    }
  }

  async function createReferenceFromUrl(sourceUrl = referenceLink) {
    const trimmedUrl = sourceUrl.trim();

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
        referenceSource?: ReferenceSource;
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

  async function retryReferenceSource(source: ReferenceSource) {
    setRetryingReferenceSourceId(source.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/references/${source.id}/retry`, {
        method: "POST",
      });
      const body = (await response.json()) as ApiResponse<{
        referenceSource?: ReferenceSource;
        job?: WorkflowJob;
        fallback?: { message?: string };
      }>;

      if (body.code !== "SUCCESS" || !body.data?.referenceSource) {
        const fallbackMessage = body.data?.fallback?.message || "";
        setErrorMessage([body.message || "参考来源重试失败", fallbackMessage].filter(Boolean).join(" "));
        await fetchProjectReferences(selectedProjectId);
        return;
      }

      mergeReferenceSource(body.data.referenceSource);
      if (body.data.job) {
        setSelectedJobId(body.data.job.id);
      }
      setNoticeMessage(body.message || "参考来源已重试");
      await fetchProjectJobs(selectedProjectId);
      await fetchProjectReferences(selectedProjectId);
    } catch (error) {
      console.error("Failed to retry reference source:", error);
      setErrorMessage("参考来源重试失败");
    } finally {
      setRetryingReferenceSourceId(null);
    }
  }

  async function approveCandidate(candidate: ScriptCandidate) {
    const riskSummary = extractRiskSummary(candidate.riskReport);
    if (!selectedJobId) {
      setErrorMessage("请先选择要绑定的视频任务");
      return;
    }

    if (riskSummary.requiresApproval && !riskConfirmations[candidate.id]) {
      setErrorMessage("风险命中候选必须先勾选人工确认");
      return;
    }

    setApprovingCandidateId(candidate.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/script-candidates/${candidate.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          confirmRisk: riskSummary.requiresApproval ? true : undefined,
        }),
      });
      const body = (await response.json()) as ApiResponse<unknown>;

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "候选文案确认失败");
        return;
      }

      setNoticeMessage("候选文案已确认并绑定视频任务");
      await fetchProjectScripts(selectedProjectId);
    } catch (error) {
      console.error("Failed to approve script candidate:", error);
      setErrorMessage("候选文案确认失败");
    } finally {
      setApprovingCandidateId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">文案库</h1>
          <div className="mt-2 text-sm text-gray-500">
            {selectedProject ? `${selectedProject.name} / ${selectedProject.targetPlatform}` : "选择项目后编辑口播文案"}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              fetchProjectScripts(selectedProjectId);
              fetchProjectJobs(selectedProjectId);
              fetchProjectReferences(selectedProjectId);
              fetchLocalModelServices();
            }}
            disabled={!selectedProjectId || loadingScripts}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            刷新
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
        <SummaryCell label="文案" value={scriptStats.scripts} />
        <SummaryCell label="候选" value={scriptStats.candidates} />
        <SummaryCell label="已确认" value={scriptStats.approved} />
        <SummaryCell label="风险命中" value={scriptStats.risk} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900">粘贴文案</h2>
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={loadingProjects}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-xs"
            >
              <option value="">{loadingProjects ? "加载项目中..." : "选择项目"}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSaveScript} className="space-y-4">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={SCRIPT_MAX_LENGTH + 200}
              rows={10}
              placeholder="粘贴需要改写或确认的口播文案"
              className="min-h-64 w-full resize-y rounded-md border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className={content.trim().length > SCRIPT_MAX_LENGTH ? "font-medium text-rose-700" : ""}>
                  {content.trim().length}/{SCRIPT_MAX_LENGTH}
                </span>
                <span className="ml-3">{formatEstimatedSpeechDuration(content)}</span>
              </div>
              <button
                type="submit"
                disabled={!canSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "保存中..." : "保存文案"}
              </button>
            </div>
          </form>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">音视频转写</h2>
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
                  {loadingMediaAssets ? "加载素材中..." : mediaAssets.length === 0 ? "暂无已授权音视频素材" : "选择素材"}
                </option>
                {mediaAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.type === "audio" ? "音频" : "视频"} / {asset.name} / {formatMediaDuration(asset.metadata)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createTranscriptionTask}
                disabled={!canCreateTranscription}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingTranscription ? "创建中..." : "创建转写任务"}
              </button>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              {selectedAsset
                ? `${selectedAsset.fileName} / ${formatMediaDuration(selectedAsset.metadata)}`
                : "仅展示已授权的音频和视频素材"}
            </div>
          </section>

          <section className="rounded-md border border-gray-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-gray-900">参考素材/链接</h2>
              <span className="text-sm text-gray-500">
                {referenceSources.length === 0 ? "暂无参考来源" : `${referenceSources.length} 条参考来源`}
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">从素材提取</label>
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
                  onClick={() => createReferenceFromAsset()}
                  disabled={!canCreateReferenceFromAsset}
                  className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingReferenceFromAsset ? "创建中..." : "提取参考结构"}
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">从链接解析</label>
                <input
                  value={referenceLink}
                  onChange={(event) => setReferenceLink(event.target.value)}
                  placeholder="粘贴抖音/快手/小红书等参考链接"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className={referenceLinkPreview.supported ? "text-sm text-emerald-700" : "text-sm text-gray-500"}>
                  {referenceLinkPreview.message}
                </div>
                <button
                  type="button"
                  onClick={() => createReferenceFromUrl()}
                  disabled={!canCreateReferenceFromUrl}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingReferenceFromUrl ? "解析中..." : "解析参考链接"}
                </button>
              </div>
            </div>

            {referenceSources.length > 0 && (
              <div className="mt-5 space-y-3">
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

        <section className="rounded-md border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">本地模型状态</h2>
          <div className="mt-4 space-y-3">
            <ModelServiceRow service={llmService} fallbackType="llm" />
            <ModelServiceRow service={asrService} fallbackType="asr" />
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700">确认候选绑定的视频任务</label>
            <select
              value={selectedJobId}
              onChange={(event) => setSelectedJobId(event.target.value)}
              disabled={!selectedProjectId || jobs.length === 0}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            >
              <option value="">{jobs.length === 0 ? "暂无可绑定任务" : "选择视频任务"}</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.id.slice(0, 8)} / {job.status} / {job.currentNode ?? "未开始"}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">文案与候选</h2>
          <span className="text-sm text-gray-500">{loadingScripts ? "加载中..." : `${scripts.length} 条`}</span>
        </div>

        {scripts.length === 0 ? (
          <div className="rounded-md border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">
            {selectedProjectId ? "暂无文案" : "请先选择项目"}
          </div>
        ) : (
          <div className="space-y-4">
            {scripts.map((script) => (
              <ScriptBlock
                key={script.id}
                script={script}
                selectedJobId={selectedJobId}
                approvingCandidateId={approvingCandidateId}
                riskConfirmations={riskConfirmations}
                onRiskConfirmationChange={(candidateId, checked) =>
                  setRiskConfirmations((current) => ({
                    ...current,
                    [candidateId]: checked,
                  }))
                }
                onApprove={approveCandidate}
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

function ModelServiceRow({
  service,
  fallbackType,
}: {
  service: LocalModelService | null;
  fallbackType: LocalModelServiceType;
}) {
  const statusView = getLocalModelStatusView(service?.status ?? "misconfigured");

  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">
          {service?.name || getLocalModelTypeLabel(fallbackType)}
        </div>
        <div className="mt-1 truncate text-xs text-gray-500">
          {fallbackType === "llm" ? service?.modelName || "未配置模型" : service?.baseUrl || "未配置服务地址"}
        </div>
        <div className="mt-1 text-xs text-gray-400">检查时间 {formatCheckedAt(service?.checkedAt ?? null)}</div>
      </div>
      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusView.className}`}>
        {statusView.label}
      </span>
    </div>
  );
}

function ScriptBlock({
  script,
  selectedJobId,
  approvingCandidateId,
  riskConfirmations,
  onRiskConfirmationChange,
  onApprove,
}: {
  script: ScriptRecord;
  selectedJobId: string;
  approvingCandidateId: string | null;
  riskConfirmations: Record<string, boolean>;
  onRiskConfirmationChange: (candidateId: string, checked: boolean) => void;
  onApprove: (candidate: ScriptCandidate) => void;
}) {
  return (
    <article className="rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium text-gray-900">
            {script.sourceType === "asr" ? "转写文案" : "粘贴文案"} / v{script.version}
          </div>
          <div className="text-xs text-gray-500">{formatDateTime(script.updatedAt)}</div>
        </div>
        {script.asrSegments.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            转写分段 {formatAsrSegmentsSummary(script.asrSegments)}
          </div>
        )}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{script.content}</p>
        {script.asrSegments.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {script.asrSegments.slice(0, 4).map((segment) => (
              <div key={segment.id} className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-medium text-gray-700">
                  {formatMediaDuration({ durationMs: segment.startMs })} - {formatMediaDuration({ durationMs: segment.endMs })}
                </span>
                <span className="ml-2">{segment.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {script.candidates.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-500">暂无候选文案</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {script.candidates.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              selectedJobId={selectedJobId}
              confirming={approvingCandidateId === candidate.id}
              riskConfirmed={riskConfirmations[candidate.id] === true}
              onRiskConfirmationChange={(checked) => onRiskConfirmationChange(candidate.id, checked)}
              onApprove={() => onApprove(candidate)}
            />
          ))}
        </div>
      )}
    </article>
  );
}

function CandidateRow({
  candidate,
  selectedJobId,
  confirming,
  riskConfirmed,
  onRiskConfirmationChange,
  onApprove,
}: {
  candidate: ScriptCandidate;
  selectedJobId: string;
  confirming: boolean;
  riskConfirmed: boolean;
  onRiskConfirmationChange: (checked: boolean) => void;
  onApprove: () => void;
}) {
  const statusView = getCandidateStatusView(candidate.status);
  const titles = normalizeTitleCandidates(candidate.titleCandidates);
  const riskSummary = extractRiskSummary(candidate.riskReport);
  const canApprove =
    statusView.canApprove &&
    Boolean(selectedJobId) &&
    !confirming &&
    (!riskSummary.requiresApproval || riskConfirmed);

  return (
    <div className="p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusView.className}`}>
              {statusView.label}
            </span>
            <span className="text-xs text-gray-500">v{candidate.version}</span>
            {candidate.modelName && <span className="text-xs text-gray-500">{candidate.modelName}</span>}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">{candidate.content}</p>
        </div>
        <button
          type="button"
          onClick={onApprove}
          disabled={!canApprove}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {confirming ? "确认中..." : "确认候选"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-gray-500">标题候选</div>
          {titles.length === 0 ? (
            <div className="mt-2 text-sm text-gray-400">暂无标题</div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {titles.map((title) => (
                <span key={title} className="rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  {title}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-gray-500">风险提示</div>
          <div className="mt-2 text-sm text-gray-700">{riskSummary.label}</div>
          {riskSummary.messages.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {riskSummary.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          {riskSummary.requiresApproval && (
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={riskConfirmed}
                onChange={(event) => onRiskConfirmationChange(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              已人工确认风险并继续使用
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
