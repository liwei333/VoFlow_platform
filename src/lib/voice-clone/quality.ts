import {
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
  VOICE_SAMPLE_MOCK_QUALITY_METRICS,
  VOICE_SAMPLE_QUALITY_LIMITS,
} from "@/lib/voice-clone/constants";

type VoiceSampleErrorCode =
  (typeof VOICE_SAMPLE_ERROR_CODES)[keyof typeof VOICE_SAMPLE_ERROR_CODES];

export type VoiceSampleQualityMetrics = {
  durationMs: number;
  averageVolumeDb?: number;
  silenceRatio?: number;
  noiseLevel?: number;
};

export type VoiceSampleQualityReason = {
  code: VoiceSampleErrorCode;
  message: string;
};

export type VoiceSampleQualityReport = {
  passed: boolean;
  durationMs: number;
  averageVolumeDb: number;
  silenceRatio: number;
  noiseLevel: number;
  limits: typeof VOICE_SAMPLE_QUALITY_LIMITS;
  reasons: VoiceSampleQualityReason[];
};

export function analyzeVoiceSampleQuality(
  metrics: VoiceSampleQualityMetrics
): VoiceSampleQualityReport {
  const averageVolumeDb =
    metrics.averageVolumeDb ?? VOICE_SAMPLE_MOCK_QUALITY_METRICS.averageVolumeDb;
  const silenceRatio = metrics.silenceRatio ?? VOICE_SAMPLE_MOCK_QUALITY_METRICS.silenceRatio;
  const noiseLevel = metrics.noiseLevel ?? VOICE_SAMPLE_MOCK_QUALITY_METRICS.noiseLevel;
  const reasons: VoiceSampleQualityReason[] = [];

  if (metrics.durationMs < VOICE_SAMPLE_QUALITY_LIMITS.minDurationMs) {
    reasons.push(createReason(VOICE_SAMPLE_ERROR_CODES.tooShort));
  }

  if (averageVolumeDb < VOICE_SAMPLE_QUALITY_LIMITS.minAverageVolumeDb) {
    reasons.push(createReason(VOICE_SAMPLE_ERROR_CODES.tooQuiet));
  }

  if (silenceRatio > VOICE_SAMPLE_QUALITY_LIMITS.maxSilenceRatio) {
    reasons.push(createReason(VOICE_SAMPLE_ERROR_CODES.silenceTooHigh));
  }

  if (noiseLevel > VOICE_SAMPLE_QUALITY_LIMITS.maxNoiseLevel) {
    reasons.push(createReason(VOICE_SAMPLE_ERROR_CODES.noisy));
  }

  return {
    passed: reasons.length === 0,
    durationMs: metrics.durationMs,
    averageVolumeDb,
    silenceRatio,
    noiseLevel,
    limits: VOICE_SAMPLE_QUALITY_LIMITS,
    reasons,
  };
}

export function getVoiceSampleQualityFailureCode(
  report: VoiceSampleQualityReport
): VoiceSampleErrorCode {
  if (report.reasons[0]?.code === VOICE_SAMPLE_ERROR_CODES.tooShort) {
    return VOICE_SAMPLE_ERROR_CODES.tooShort;
  }

  return VOICE_SAMPLE_ERROR_CODES.qualityNotPassed;
}

function createReason(code: VoiceSampleErrorCode): VoiceSampleQualityReason {
  return {
    code,
    message: VOICE_SAMPLE_ERROR_MESSAGES[code],
  };
}
