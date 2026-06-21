"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TTS_PITCH_RANGE, TTS_SPEED_RANGE } from "@/lib/tts/constants";
import type { SerializedVoice } from "@/lib/tts/serializer";

type Project = {
  id: string;
  name: string;
  targetPlatform: string;
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
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [lastResult, setLastResult] = useState<TtsResult | null>(null);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.id === selectedVoiceId) ?? null,
    [selectedVoiceId, voices]
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
  const canCreateTts =
    Boolean(selectedVoiceId) &&
    Boolean(selectedProjectId) &&
    Boolean(selectedCandidateId) &&
    Boolean(selectedJobId) &&
    !creating;

  const fetchVoices = useCallback(async () => {
    const response = await fetch("/api/voices");
    const body = (await response.json()) as ApiResponse<{ voices: SerializedVoice[] }>;

    if (body.code !== "SUCCESS" || !body.data) {
      setVoices([]);
      setErrorMessage(body.message || "音色加载失败");
      return;
    }

    setVoices(body.data.voices);
    setSelectedVoiceId((current) => current || body.data?.voices[0]?.id || "");
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

  async function createTts() {
    if (!canCreateTts) {
      setErrorMessage("请先选择音色、文案和视频任务");
      return;
    }

    setCreating(true);
    setErrorMessage("");
    setNoticeMessage("");

    try {
      const response = await fetch(`/api/video-jobs/${selectedJobId}/tts`, {
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
        return;
      }

      setLastResult(body.data);
      setNoticeMessage("TTS 任务已创建");
    } catch (error) {
      console.error("Failed to create TTS task:", error);
      setErrorMessage("TTS 任务创建失败");
    } finally {
      setCreating(false);
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-md border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">音色选择</h2>
            <span className="text-sm text-gray-500">{voices.length} 个可用音色</span>
          </div>

          {voices.length === 0 ? (
            <div className="rounded-md border border-gray-200 px-5 py-12 text-center text-sm text-gray-500">
              {loading ? "加载音色中..." : "暂无可用音色"}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {voices.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  onClick={() => setSelectedVoiceId(voice.id)}
                  className={`rounded-md border p-4 text-left ${
                    selectedVoiceId === voice.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{voice.name}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {voice.voiceType === "preset" ? "预置音色" : "克隆音色"} / {voice.provider}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      可用
                    </span>
                  </div>
                  {voice.sampleUrl && (
                    <audio
                      className="mt-3 w-full"
                      src={voice.sampleUrl}
                      controls
                      onClick={(event) => event.stopPropagation()}
                    />
                  )}
                </button>
              ))}
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

      <section className="rounded-md border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">语音结果</h2>
          <span className="text-sm text-gray-500">
            {selectedVoice ? `${selectedVoice.name} / ${selectedVoice.modelId}` : "未选择音色"}
          </span>
        </div>
        {lastResult ? (
          <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-4">
            <ResultCell label="请求" value={lastResult.ttsRequest.id.slice(0, 8)} />
            <ResultCell label="节点" value={`v${lastResult.node.version} / ${lastResult.node.status}`} />
            <ResultCell label="语速" value={lastResult.ttsRequest.speed.toString()} />
            <ResultCell label="音调" value={lastResult.ttsRequest.pitch.toString()} />
          </div>
        ) : (
          <div className="rounded-md border border-gray-200 px-5 py-12 text-center text-sm text-gray-500">
            暂无生成结果
          </div>
        )}
      </section>
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

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 font-medium text-gray-900">{value}</div>
    </div>
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
