import {
  EXPORT_ERROR_CODES,
  EXPORT_MEDIA_VALIDATION_LIMITS,
} from "@/lib/export/constants";

export interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
}

export interface FfprobeResult {
  format?: {
    duration?: string | number | null;
  };
  streams?: FfprobeStream[];
}

export type FinalVideoValidationResult =
  | { valid: true }
  | {
      valid: false;
      error: {
        code: typeof EXPORT_ERROR_CODES.exportMediaValidationFailed;
        message: string;
      };
    };

export interface ValidateFinalVideoProbeInput {
  sizeBytes: number;
  probe: FfprobeResult;
  expectedDurationSeconds?: number | null;
}

export function buildFfprobeArgs(filePath: string): string[] {
  return [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ];
}

export function validateFinalVideoProbe(
  input: ValidateFinalVideoProbeInput
): FinalVideoValidationResult {
  if (input.sizeBytes <= 0) {
    return failed("最终 MP4 文件为空");
  }

  const streams = input.probe.streams ?? [];
  if (!streams.some((stream) => stream.codec_type === "video")) {
    return failed("最终 MP4 缺少视频流");
  }
  if (!streams.some((stream) => stream.codec_type === "audio")) {
    return failed("最终 MP4 缺少音频流");
  }

  const durationSeconds = Number(input.probe.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return failed("最终 MP4 时长无效");
  }

  if (input.expectedDurationSeconds && input.expectedDurationSeconds > 0) {
    const driftMs = Math.abs(durationSeconds - input.expectedDurationSeconds) * 1000;
    if (driftMs > EXPORT_MEDIA_VALIDATION_LIMITS.durationToleranceMs) {
      return failed(
        `最终 MP4 时长偏差超过 ${EXPORT_MEDIA_VALIDATION_LIMITS.durationToleranceMs}ms`
      );
    }
  }

  return { valid: true };
}

function failed(message: string): FinalVideoValidationResult {
  return {
    valid: false,
    error: {
      code: EXPORT_ERROR_CODES.exportMediaValidationFailed,
      message,
    },
  };
}
