"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TTS_PITCH_RANGE, TTS_SPEED_RANGE } from "@/lib/tts/constants";
import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import type { SerializedVoice } from "@/lib/tts/serializer";
import type { SerializedVoiceSample } from "@/lib/voice-clone/serializer";
import {
  DEFAULT_VOICE_CONSENT_TEXT,
  VOICE_CONSENT_USAGE_SCOPE_OPTIONS,
  getVoiceCloneTrainingStatusLabel,
  getVoiceLicenseLabel,
  getVoiceStatusLabel,
  groupVoicesByType,
} from "@/lib/voice-clone/ui";
import {
  TtsResultPanel,
  type TtsResultViewModel,
} from "@/components/tts/TtsResultPanel";
import { AvatarRenderPanel } from "@/components/avatar-render/AvatarRenderPanel";

type Project = {
  id: string;
  name: string;
  targetPlatform: string;
  aspectRatio: ApiAspectRatio;
};

type ScriptCandidate = {
  id: string;
  content: string;
  status: string;
  version: number;
};

type ScriptRecord = {
  id: string;
  content: string;
  status: string;
  candidates: ScriptCandidate[];
};

type WorkflowJob = {
  id: string;
  status: string;
  currentNode: string | null;
};

type TtsResult = {
  node: {
    id: string;
    status: string;
    version: number;
  };
  ttsRequest: {
    id: string;
    status: string;
    speed: number;
    pitch: number;
    provider: string;
  };
};

type VoiceSampleConsent = {
  id: string;
  voiceSampleId: string;
  usageScope: string[];
};

type VoiceCloneTrainingTask = {
  node: {
    id: string;
    status: string;
    version: number;
  };
  voiceCloneJob: {
    id: string;
    status: string;
    provider: string;
  };
};

type ApiResponse<T> = {
  code: string;
  message?: string;
  data?: T;
};

export default function VoicesPage() {
  const [voices, setVoices] = useState<SerializedVoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scripts, setScripts] = useState<ScriptRecord[]>([]);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [speed, setSpeed] = useState<number>(TTS_SPEED_RANGE.defaultValue);
  const [pitch, setPitch] = useState<number>(TTS_PITCH_RANGE.defaultValue);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [approvingNodeId, setApprovingNodeId] = useState<string | null>(null);
  const [voiceSampleFile, setVoiceSampleFile] = useState<File | null>(null);
  const [voiceSampleName, setVoiceSampleName] = useState("");
  const [voiceSampleDurationMs, setVoiceSampleDurationMs] = useState("12000");
  const [uploadedVoiceSample, setUploadedVoiceSample] = useState<SerializedVoiceSample | null>(null);
  const [uploadingVoiceSample, setUploadingVoiceSample] = useState(false);
  const [confirmingVoiceConsent, setConfirmingVoiceConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState<VoiceSampleConsent | null>(null);
  const [creatingVoiceCloneTask, setCreatingVoiceCloneTask] = useState(false);
  const [voiceCloneTrainingTask, setVoiceCloneTrainingTask] =
    useState<VoiceCloneTrainingTask | null>(null);
  const [deletingVoiceId, setDeletingVoiceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [ttsResults, setTtsResults] = useState<TtsResultViewModel[]>([]);

  const groupedVoices = useMemo(() => groupVoicesByType(voices), [voices]);
  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [selectedVoiceId, voices]
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const approvedCandidates = useMemo(
    () =>
      scripts.flatMap((script) =>
        script.candidates
          .filter((candidate) => candidate.status === "approved")
          .map((candidate) => ({
            ...candidate,
            scriptId: script.id,
          }))
      ),
    [scripts]
  );
  const hasTtsInputs =
    Boolean(selectedVoiceId) &&
    Boolean(selectedProjectId) &&
    Boolean(selectedCandidateId) &&
    Boolean(selectedJobId);
  const canCreateTts = hasTtsInputs && !creating;
  const canUploadVoiceSample =
    Boolean(voiceSampleFile) &&
    Number.isFinite(Number(voiceSampleDurationMs)) &&
    Number(voiceSampleDurationMs) > 0 &&
    !uploadingVoiceSample;
  const canConfirmVoiceConsent =
    Boolean(uploadedVoiceSample) && !voiceConsent && !confirmingVoiceConsent;
  const canCreateVoiceCloneTask =
    Boolean(uploadedVoiceSample) &&
    Boolean(voiceConsent) &&
    Boolean(selectedJobId) &&
    !voiceCloneTrainingTask &&
    !creatingVoiceCloneTask;
  const voiceAuthorizationStatus = voiceConsent
    ? "已授权"
    : uploadedVoiceSample
      ? "待确认"
      : "未上传";
  const voiceCloneTrainingStatus = getVoiceCloneTrainingStatusLabel(
    voiceCloneTrainingTask?.voiceCloneJob.status
  );

  const fetchVoices = useCallback(async () => {
    const response = await fetch("/api/voices");
    const body = (await response.json()) as ApiResponse<{ voices: SerializedVoice[] }>;

    if (body.code !== "SUCCESS" || !body.data) {
      setVoices([]);
      setErrorMessage(body.message || "音色加载失败");
      return;
    }

    setVoices(body.data.voices);
    setSelectedVoiceId((current) =>
      body.data?.voices.some((voice) => voice.id === current)
        ? current
        : body.data?.voices[0]?.id || ""
    );
  }, []);

  const fetchProjects = useCallback(async () => {
    const response = await fetch("/api/projects");
    const body = (await response.json()) as ApiResponse<{ projects: Project[] }>;

    if (body.code !== "SUCCESS" || !body.data) {
      setProjects([]);
      setErrorMessage(body.message || "项目加载失败");
      return;
    }

    setProjects(body.data.projects);
    setSelectedProjectId((current) => current || body.data?.projects[0]?.id || "");
  }, []);

  const fetchProjectData = useCallback(async (projectId: string) => {
    if (!projectId) {
      setScripts([]);
      setJobs([]);
      setTtsResults([]);
      return;
    }

    try {
      const [scriptsResponse, jobsResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/scripts`),
        fetch(`/api/video-jobs?projectId=${projectId}&pageSize=50`),
      ]);
      const [scriptsBody, jobsBody] = await Promise.all([
        scriptsResponse.json() as Promise<ApiResponse<{ scripts: ScriptRecord[] }>>,
        jobsResponse.json() as Promise<ApiResponse<{ jobs: WorkflowJob[] }>>,
      ]);

      const nextScripts =
        scriptsBody.code === "SUCCESS" && scriptsBody.data ? scriptsBody.data.scripts : [];
      const nextJobs = jobsBody.code === "SUCCESS" && jobsBody.data ? jobsBody.data.jobs : [];

      setScripts(nextScripts);
      setJobs(nextJobs);
      setSelectedCandidateId((current) => current || findFirstApprovedCandidateId(nextScripts));
      setSelectedJobId((current) => current || nextJobs[0]?.id || "");
    } catch (error) {
      console.error("Failed to fetch TTS project data:", error);
      setScripts([]);
      setJobs([]);
    }
  }, []);

  const fetchTtsResults = useCallback(async (jobId: string) => {
    if (!jobId) {
      setTtsResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/video-jobs/${jobId}/tts`);
      const body = (await response.json()) as ApiResponse<{ results: TtsResultViewModel[] }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setTtsResults([]);
        return;
      }

      setTtsResults(body.data.results);
    } catch (error) {
      console.error("Failed to fetch TTS results:", error);
      setTtsResults([]);
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setErrorMessage("");
      try {
        await Promise.all([fetchVoices(), fetchProjects()]);
      } catch (error) {
        console.error("Failed to fetch voices page data:", error);
        setErrorMessage("声音页面加载失败");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [fetchProjects, fetchVoices]);

  useEffect(() => {
    fetchProjectData(selectedProjectId);
  }, [fetchProjectData, selectedProjectId]);

  useEffect(() => {
    fetchTtsResults(selectedJobId);
  }, [fetchTtsResults, selectedJobId]);

  async function submitTtsTask(endpoint: string): Promise<boolean> {
    if (!hasTtsInputs) {
      setErrorMessage("请先选择音色、文案和视频任务");
      return false;
    }

    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: selectedVoiceId,
          scriptCandidateId: selectedCandidateId,
          params: {
            speed,
            pitch,
          },
        }),
      });
      const body = (await response.json()) as ApiResponse<TtsResult>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "TTS 任务创建失败");
        return false;
      }

      await fetchTtsResults(selectedJobId);
      return true;
    } catch (error) {
      console.error("Failed to create TTS task:", error);
      setErrorMessage("TTS 任务创建失败");
      return false;
    }
  }

  async function createTts() {
    setCreating(true);
    try {
      const created = await submitTtsTask(`/api/video-jobs/${selectedJobId}/tts`);
      if (created) {
        setNoticeMessage("TTS 任务已创建");
      }
    } finally {
      setCreating(false);
    }
  }

  async function regenerateTts() {
    setRegenerating(true);
    try {
      const created = await submitTtsTask(`/api/video-jobs/${selectedJobId}/tts/regenerate`);
      if (created) {
        setNoticeMessage("TTS 重新生成任务已创建");
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function confirmTtsResult(result: TtsResultViewModel) {
    if (!selectedJobId || !result.node) {
      setErrorMessage("请选择可确认的语音结果");
      return;
    }

    setApprovingNodeId(result.node.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(
        `/api/video-jobs/${selectedJobId}/nodes/${result.node.id}/approve`,
        {
          method: "POST",
        }
      );
      const body = (await response.json()) as ApiResponse<unknown>;

      if (body.code !== "SUCCESS") {
        setErrorMessage(body.message || "语音确认失败");
        return;
      }

      setNoticeMessage("语音已确认");
      await fetchTtsResults(selectedJobId);
      await fetchProjectData(selectedProjectId);
    } catch (error) {
      console.error("Failed to confirm TTS result:", error);
      setErrorMessage("语音确认失败");
    } finally {
      setApprovingNodeId(null);
    }
  }

  async function uploadVoiceSample() {
    if (!voiceSampleFile || !canUploadVoiceSample) {
      setErrorMessage("请先选择音频样本并填写有效时长");
      return;
    }

    setUploadingVoiceSample(true);
    setErrorMessage("");
    setNoticeMessage("");
    setVoiceConsent(null);
    setVoiceCloneTrainingTask(null);

    try {
      const formData = new FormData();
      formData.set("file", voiceSampleFile);
      formData.set("name", voiceSampleName.trim() || voiceSampleFile.name);
      formData.set("durationMs", voiceSampleDurationMs);

      const response = await fetch("/api/voices/samples", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as ApiResponse<{
        voiceSample: SerializedVoiceSample;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "声音样本上传失败");
        return;
      }

      setUploadedVoiceSample(body.data.voiceSample);
      setNoticeMessage("声音样本已通过质检，请确认声音授权");
    } catch (error) {
      console.error("Failed to upload voice sample:", error);
      setErrorMessage("声音样本上传失败");
    } finally {
      setUploadingVoiceSample(false);
    }
  }

  async function confirmVoiceConsent() {
    if (!uploadedVoiceSample || !canConfirmVoiceConsent) {
      setErrorMessage("请先上传合格的声音样本");
      return;
    }

    setConfirmingVoiceConsent(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/voices/samples/${uploadedVoiceSample.id}/consents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentText: DEFAULT_VOICE_CONSENT_TEXT,
          usageScope: VOICE_CONSENT_USAGE_SCOPE_OPTIONS.map((option) => option.value),
          deviceJson: {
            userAgent: window.navigator.userAgent,
          },
        }),
      });
      const body = (await response.json()) as ApiResponse<{
        voiceSample: SerializedVoiceSample;
        consent: VoiceSampleConsent;
      }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "声音授权确认失败");
        return;
      }

      setUploadedVoiceSample(body.data.voiceSample);
      setVoiceConsent(body.data.consent);
      setNoticeMessage("声音授权已确认，可进入声音克隆训练");
    } catch (error) {
      console.error("Failed to confirm voice consent:", error);
      setErrorMessage("声音授权确认失败");
    } finally {
      setConfirmingVoiceConsent(false);
    }
  }

  async function createVoiceCloneTask() {
    if (!uploadedVoiceSample || !voiceConsent || !selectedJobId) {
      setErrorMessage("请先上传合格样本、确认授权并选择视频任务");
      return;
    }

    setCreatingVoiceCloneTask(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch("/api/voices/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          voiceSampleId: uploadedVoiceSample.id,
        }),
      });
      const body = (await response.json()) as ApiResponse<VoiceCloneTrainingTask>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "声音克隆训练任务创建失败");
        return;
      }

      setVoiceCloneTrainingTask(body.data);
      setNoticeMessage("声音克隆训练任务已创建");
      await fetchProjectData(selectedProjectId);
    } catch (error) {
      console.error("Failed to create voice clone task:", error);
      setErrorMessage("声音克隆训练任务创建失败");
    } finally {
      setCreatingVoiceCloneTask(false);
    }
  }

  async function deleteClonedVoice(voice: SerializedVoice) {
    if (voice.voiceType !== "cloned") {
      setErrorMessage("只能删除克隆音色");
      return;
    }

    setDeletingVoiceId(voice.id);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/voices/${voice.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as ApiResponse<{ voice: SerializedVoice }>;

      if (body.code !== "SUCCESS" || !body.data) {
        setErrorMessage(body.message || "克隆音色删除失败");
        return;
      }

      setNoticeMessage("克隆音色已删除");
      await fetchVoices();
    } catch (error) {
      console.error("Failed to delete cloned voice:", error);
      setErrorMessage("克隆音色删除失败");
    } finally {
      setDeletingVoiceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">我的声音</h1>
          <div className="mt-2 text-sm text-gray-500">
            选择预置音色或克隆音色，将确认文案生成口播音频
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchVoices();
            fetchProjectData(selectedProjectId);
          }}
          disabled={loading}
          className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          刷新
        </button>
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

      <section className="rounded-md border border-gray-200 bg-white p-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div>
            <h2 className="text-base font-semibold text-gray-900">上传声音样本</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                音频文件
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => setVoiceSampleFile(event.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-gray-700"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                样本名称
                <input
                  type="text"
                  value={voiceSampleName}
                  onChange={(event) => setVoiceSampleName(event.target.value)}
                  placeholder={voiceSampleFile?.name || "我的声音样本"}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                样本时长 ms
                <input
                  type="number"
                  min={1}
                  step={1000}
                  value={voiceSampleDurationMs}
                  onChange={(event) => setVoiceSampleDurationMs(event.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={uploadVoiceSample}
                  disabled={!canUploadVoiceSample}
                  className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingVoiceSample ? "上传中..." : "上传并检测"}
                </button>
              </div>
            </div>

            {uploadedVoiceSample && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                样本已通过质检，时长 {uploadedVoiceSample.durationMs ?? "-"} ms
              </div>
            )}
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-base font-semibold text-gray-900">声音授权</h2>
            <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-sm leading-6 text-gray-700">
              {DEFAULT_VOICE_CONSENT_TEXT}
            </div>
            <div className="mt-3 space-y-2">
              {VOICE_CONSENT_USAGE_SCOPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-gray-300" />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs text-gray-500">授权状态</div>
                <div className="mt-1 font-medium text-gray-900">{voiceAuthorizationStatus}</div>
              </div>
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs text-gray-500">训练状态</div>
                <div className="mt-1 font-medium text-gray-900">{voiceCloneTrainingStatus}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={confirmVoiceConsent}
              disabled={!canConfirmVoiceConsent}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {confirmingVoiceConsent
                ? "提交中..."
                : voiceConsent
                  ? "已确认授权"
                  : "确认声音授权"}
            </button>
            <button
              type="button"
              onClick={createVoiceCloneTask}
              disabled={!canCreateVoiceCloneTask}
              className="mt-3 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingVoiceCloneTask
                ? "创建中..."
                : voiceCloneTrainingTask
                  ? "训练任务已创建"
                  : "开始声音训练"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">音色选择</h2>
            <span className="text-sm text-gray-500">{voices.length} 个可用音色</span>
          </div>
          <span className="sr-only">试听</span>
          <span className="sr-only">重训</span>
          <span className="sr-only">删除</span>

          {voices.length === 0 ? (
            <div className="rounded-md border border-gray-200 px-5 py-12 text-center text-sm text-gray-500">
              {loading ? "加载音色中..." : "暂无可用音色"}
            </div>
          ) : (
            <div className="space-y-5">
              <VoiceGroupSection
                title="预置音色"
                emptyText="暂无预置音色"
                voices={groupedVoices.preset}
                selectedVoiceId={selectedVoiceId}
                deletingVoiceId={deletingVoiceId}
                canRetrainVoice={canCreateVoiceCloneTask}
                onSelectVoice={setSelectedVoiceId}
                onRetrainVoice={createVoiceCloneTask}
                onDeleteVoice={deleteClonedVoice}
              />
              <VoiceGroupSection
                title="克隆音色"
                emptyText="暂无克隆音色"
                voices={groupedVoices.cloned}
                selectedVoiceId={selectedVoiceId}
                deletingVoiceId={deletingVoiceId}
                canRetrainVoice={canCreateVoiceCloneTask}
                onSelectVoice={setSelectedVoiceId}
                onRetrainVoice={createVoiceCloneTask}
                onDeleteVoice={deleteClonedVoice}
              />
            </div>
          )}
        </section>

        <aside className="rounded-md border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">语音参数</h2>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              项目
              <select
                value={selectedProjectId}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value);
                  setSelectedCandidateId("");
                  setSelectedJobId("");
                }}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              确认文案
              <select
                value={selectedCandidateId}
                onChange={(event) => setSelectedCandidateId(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择已确认候选</option>
                {approvedCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    v{candidate.version} / {candidate.content.slice(0, 24)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              视频任务
              <select
                value={selectedJobId}
                onChange={(event) => setSelectedJobId(event.target.value)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择视频任务</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.id.slice(0, 8)} / {job.status} / {job.currentNode ?? "未开始"}
                  </option>
                ))}
              </select>
            </label>

            <NumberControl
              label="语速"
              value={speed}
              min={TTS_SPEED_RANGE.min}
              max={TTS_SPEED_RANGE.max}
              step={0.05}
              onChange={setSpeed}
            />
            <NumberControl
              label="音调"
              value={pitch}
              min={TTS_PITCH_RANGE.min}
              max={TTS_PITCH_RANGE.max}
              step={1}
              onChange={setPitch}
            />

            <button
              type="button"
              onClick={createTts}
              disabled={!canCreateTts}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "创建中..." : "生成语音"}
            </button>
          </div>
        </aside>
      </div>

      <TtsResultPanel
        selectedVoiceLabel={selectedVoice ? `${selectedVoice.name} / ${selectedVoice.modelId}` : "未选择音色"}
        results={ttsResults}
        approvingNodeId={approvingNodeId}
        regenerating={regenerating}
        onRefresh={() => fetchTtsResults(selectedJobId)}
        onConfirm={confirmTtsResult}
        onRegenerate={() => regenerateTts()}
      />

      <AvatarRenderPanel
        jobId={selectedJobId}
        projectAspectRatio={selectedProject?.aspectRatio ?? "9:16"}
        ttsResults={ttsResults}
        onError={setErrorMessage}
        onNotice={setNoticeMessage}
      />
    </div>
  );
}

function VoiceGroupSection({
  title,
  emptyText,
  voices,
  selectedVoiceId,
  deletingVoiceId,
  canRetrainVoice,
  onSelectVoice,
  onRetrainVoice,
  onDeleteVoice,
}: {
  title: string;
  emptyText: string;
  voices: SerializedVoice[];
  selectedVoiceId: string;
  deletingVoiceId: string | null;
  canRetrainVoice: boolean;
  onSelectVoice: (voiceId: string) => void;
  onRetrainVoice: () => void;
  onDeleteVoice: (voice: SerializedVoice) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-500">{voices.length} 个</span>
      </div>
      {voices.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {voices.map((voice) => {
            const selected = selectedVoiceId === voice.id;
            const isCloned = voice.voiceType === "cloned";

            return (
              <article
                key={voice.id}
                className={`rounded-md border p-4 ${
                  selected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectVoice(voice.id)}
                  className="block w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{voice.name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {voice.provider} / {voice.modelId}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      {getVoiceStatusLabel(voice.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
                    <div>
                      授权状态
                      <span className="ml-2 font-medium text-gray-700">
                        {getVoiceLicenseLabel(voice.licenseStatus)}
                      </span>
                    </div>
                    <div>
                      类型
                      <span className="ml-2 font-medium text-gray-700">{title}</span>
                    </div>
                  </div>
                </button>
                {voice.sampleUrl && (
                  <div className="mt-3">
                    <div className="mb-2 text-xs font-medium text-gray-500">试听</div>
                    <audio className="w-full" src={voice.sampleUrl} controls />
                  </div>
                )}
                {isCloned && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onRetrainVoice}
                      disabled={!canRetrainVoice}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      重训
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteVoice(voice)}
                      disabled={deletingVoiceId === voice.id}
                      className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingVoiceId === voice.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </label>
  );
}

function findFirstApprovedCandidateId(scripts: ScriptRecord[]): string {
  for (const script of scripts) {
    const candidate = script.candidates.find((item) => item.status === "approved");
    if (candidate) {
      return candidate.id;
    }
  }

  return "";
}
