export const VOICE_SAMPLE_ASSET_METADATA_SOURCE = "voice_sample";

export const VOICE_SAMPLE_API_MESSAGES = {
  missingFile: "缺少声音样本文件",
  uploadSuccess: "声音样本上传成功",
  consentSuccess: "声音授权确认成功",
  cloneTaskSuccess: "声音克隆训练任务已创建",
  internalError: "服务器内部错误",
} as const;

export const VOICE_SAMPLE_ERROR_CODES = {
  notFound: "VOICE_SAMPLE_NOT_FOUND",
  jobNotFound: "VOICE_CLONE_JOB_NOT_FOUND",
  durationInvalid: "VOICE_SAMPLE_DURATION_INVALID",
  qualityMetricInvalid: "VOICE_SAMPLE_QUALITY_METRIC_INVALID",
  consentRequired: "VOICE_SAMPLE_CONSENT_REQUIRED",
  tooShort: "VOICE_SAMPLE_TOO_SHORT",
  tooQuiet: "VOICE_SAMPLE_TOO_QUIET",
  silenceTooHigh: "VOICE_SAMPLE_SILENCE_TOO_HIGH",
  noisy: "VOICE_SAMPLE_NOISY",
  qualityNotPassed: "VOICE_SAMPLE_QUALITY_NOT_PASSED",
  taskCreateFailed: "VOICE_CLONE_TASK_CREATE_FAILED",
  trainingFailed: "VOICE_CLONE_TRAINING_FAILED",
  trainerUnavailable: "VOICE_CLONE_TRAINER_UNAVAILABLE",
  invalidTrainerOutput: "VOICE_CLONE_INVALID_TRAINER_OUTPUT",
} as const;

export const VOICE_SAMPLE_ERROR_MESSAGES = {
  [VOICE_SAMPLE_ERROR_CODES.notFound]: "声音样本不存在",
  [VOICE_SAMPLE_ERROR_CODES.jobNotFound]: "视频任务不存在",
  [VOICE_SAMPLE_ERROR_CODES.durationInvalid]: "声音样本时长必须是正整数毫秒",
  [VOICE_SAMPLE_ERROR_CODES.qualityMetricInvalid]: "声音样本质量指标必须是有效数字",
  [VOICE_SAMPLE_ERROR_CODES.consentRequired]: "请先确认声音授权",
  [VOICE_SAMPLE_ERROR_CODES.tooShort]: "声音样本时长过短",
  [VOICE_SAMPLE_ERROR_CODES.tooQuiet]: "声音样本音量过低",
  [VOICE_SAMPLE_ERROR_CODES.silenceTooHigh]: "声音样本静音比例过高",
  [VOICE_SAMPLE_ERROR_CODES.noisy]: "声音样本噪声过高",
  [VOICE_SAMPLE_ERROR_CODES.qualityNotPassed]: "声音样本质量未通过",
  [VOICE_SAMPLE_ERROR_CODES.taskCreateFailed]: "声音克隆训练任务创建失败",
  [VOICE_SAMPLE_ERROR_CODES.trainingFailed]: "声音克隆训练失败",
  [VOICE_SAMPLE_ERROR_CODES.trainerUnavailable]: "本地声音训练服务不可用",
  [VOICE_SAMPLE_ERROR_CODES.invalidTrainerOutput]: "声音训练服务返回结果无效",
} as const;

export const VOICE_SAMPLE_QUALITY_LIMITS = {
  minDurationMs: 10_000,
  minAverageVolumeDb: -45,
  maxSilenceRatio: 0.4,
  maxNoiseLevel: 0.6,
} as const;

export const VOICE_SAMPLE_MOCK_QUALITY_METRICS = {
  averageVolumeDb: -18,
  silenceRatio: 0.05,
  noiseLevel: 0.1,
} as const;

export const VOICE_CONSENT_USAGE_SCOPES = [
  "voice_clone",
  "tts_generation",
] as const;

export const VOICE_CLONE_NODE_TYPE = "voice_clone";
export const VOICE_CLONE_MOCK_PROVIDER = "mock";
export const VOICE_CLONE_LOCAL_PROVIDER = "local";
export const VOICE_CLONE_GPT_SOVITS_PROVIDER = "gpt-sovits";
export const VOICE_CLONE_COSYVOICE_PROVIDER = "cosyvoice";
export const VOICE_CLONE_LOCAL_TRAIN_PATH = "/voice-clone/train";
export const VOICE_CLONE_LOCAL_TIMEOUT_MS = 60_000;
