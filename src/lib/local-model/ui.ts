import { LocalModelServiceStatus, LocalModelServiceType } from "@/lib/local-model/config";

const SERVICE_TYPE_LABELS: Record<LocalModelServiceType, string> = {
  llm: "本地 LLM",
  asr: "ASR 转写",
  tts: "TTS 语音",
  avatar: "数字人渲染",
  ffmpeg: "FFmpeg",
};

const STATUS_VIEWS: Record<
  LocalModelServiceStatus,
  { label: string; className: string; dotClassName: string }
> = {
  online: {
    label: "在线",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dotClassName: "bg-emerald-500",
  },
  offline: {
    label: "离线",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    dotClassName: "bg-rose-500",
  },
  busy: {
    label: "繁忙",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    dotClassName: "bg-amber-500",
  },
  misconfigured: {
    label: "未配置",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    dotClassName: "bg-slate-400",
  },
};

export function getLocalModelTypeLabel(type: LocalModelServiceType): string {
  return SERVICE_TYPE_LABELS[type];
}

export function getLocalModelStatusView(status: LocalModelServiceStatus) {
  return STATUS_VIEWS[status];
}

export function formatLatency(latencyMs: number | null | undefined): string {
  if (latencyMs === null || latencyMs === undefined) {
    return "-";
  }

  return `${latencyMs} ms`;
}

export function formatCheckedAt(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
