export const SCRIPT_MAX_LENGTH = 3000;

export interface RiskSummary {
  requiresApproval: boolean;
  label: string;
  messages: string[];
}

export interface MediaAssetLike {
  type: string;
  licenseStatus: string;
}

export interface AsrSegmentLike {
  startMs: number;
  endMs: number;
  text: string;
}

export function formatEstimatedSpeechDuration(content: string): string {
  const normalizedLength = content.trim().length;
  const seconds = normalizedLength === 0 ? 0 : Math.max(3, Math.ceil(normalizedLength / 4));

  if (seconds < 60) {
    return `约 ${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `约 ${minutes} 分` : `约 ${minutes} 分 ${remainingSeconds} 秒`;
}

export function formatMediaDuration(metadata: unknown): string {
  const durationMs = getDurationMs(metadata);
  if (durationMs === null) {
    return "未知时长";
  }

  return formatDurationMs(durationMs);
}

export function isTranscribableMediaAsset(asset: MediaAssetLike): boolean {
  return (asset.type === "audio" || asset.type === "video") && asset.licenseStatus === "approved";
}

export function formatAsrSegmentsSummary(segments: AsrSegmentLike[]): string {
  if (segments.length === 0) {
    return "0 段";
  }

  const endMs = Math.max(...segments.map((segment) => segment.endMs));
  return `${segments.length} 段 / ${formatDurationMs(endMs)}`;
}

export function normalizeTitleCandidates(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractRiskSummary(value: unknown): RiskSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      requiresApproval: false,
      label: "未检查",
      messages: [],
    };
  }

  const report = value as Record<string, unknown>;
  const requiresApproval = report.requiresApproval === true;
  const status = typeof report.status === "string" ? report.status : "";
  const messages = extractRiskMessages(report.findings);

  if (requiresApproval) {
    return {
      requiresApproval: true,
      label: "需人工确认",
      messages,
    };
  }

  if (status === "passed") {
    return {
      requiresApproval: false,
      label: "未命中风险",
      messages,
    };
  }

  return {
    requiresApproval: false,
    label: status ? "已检查" : "未检查",
    messages,
  };
}

export function getCandidateStatusView(status: string): {
  label: string;
  className: string;
  canApprove: boolean;
} {
  if (status === "approved") {
    return {
      label: "已确认",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      canApprove: false,
    };
  }

  if (status === "rejected") {
    return {
      label: "已排除",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
      canApprove: false,
    };
  }

  return {
    label: "待确认",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
    canApprove: true,
  };
}

function extractRiskMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return "";
      }

      const finding = item as Record<string, unknown>;
      return typeof finding.message === "string" ? finding.message.trim() : "";
    })
    .filter(Boolean);
}

function getDurationMs(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata as Record<string, unknown>;
  if (typeof value.durationMs === "number" && Number.isFinite(value.durationMs)) {
    return Math.max(0, Math.round(value.durationMs));
  }

  if (typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds)) {
    return Math.max(0, Math.round(value.durationSeconds * 1000));
  }

  return null;
}

function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} 分` : `${minutes} 分 ${seconds} 秒`;
}
