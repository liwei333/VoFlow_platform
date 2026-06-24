export const AVATAR_RENDER_NODE_TYPE = "avatar_render";

export const AVATAR_RENDER_MODES = ["preview", "hd"] as const;
export type AvatarRenderMode = (typeof AVATAR_RENDER_MODES)[number];

export const AVATAR_RENDER_CROPS = ["head", "half_body"] as const;
export type AvatarRenderCrop = (typeof AVATAR_RENDER_CROPS)[number];

export const AVATAR_RENDER_DEFAULT_RESOLUTIONS: Record<AvatarRenderMode, string> = {
  preview: "720p",
  hd: "1080p",
};

export const AVATAR_RENDER_MOCK_PROVIDER = "mock";
export const AVATAR_RENDER_LOCAL_PROVIDER = "local";
export const AVATAR_RENDER_LOCAL_RENDER_PATH = "/avatar-render/render";
export const AVATAR_RENDER_LOCAL_TIMEOUT_MS = 60_000;

export const AVATAR_RENDER_MOCK_MODEL = "mock-avatar-render";
export const AVATAR_RENDER_MOCK_DURATION_MS = 200;
export const AVATAR_RENDER_VIDEO_CONTENT_TYPE = "video/mp4";
export const AVATAR_RENDER_VIDEO_EXTENSION = "mp4";
export const AVATAR_RENDER_VIDEO_ARTIFACT_TYPE = "avatar_video";
export const AVATAR_RENDER_MIN_OUTPUT_BYTES = 1_024;
export const AVATAR_RENDER_FFPROBE_TIMEOUT_MS = 5_000;
export const AVATAR_RENDER_DEFAULT_FFPROBE_BIN = "ffprobe";

export const AVATAR_RENDER_ERROR_CODES = {
  jobNotFound: "AVATAR_RENDER_JOB_NOT_FOUND",
  renderRequestNotFound: "AVATAR_RENDER_REQUEST_NOT_FOUND",
  previewNotWaitingApproval: "AVATAR_RENDER_PREVIEW_NOT_WAITING_APPROVAL",
  workerInputInvalid: "AVATAR_RENDER_WORKER_INPUT_INVALID",
  avatarNotReady: "AVATAR_NOT_READY",
  avatarLicenseNotApproved: "AVATAR_LICENSE_NOT_APPROVED",
  ttsAudioNotFound: "TTS_AUDIO_NOT_FOUND",
  aspectRatioMismatch: "AVATAR_RENDER_ASPECT_RATIO_MISMATCH",
  providerUnavailable: "AVATAR_PROVIDER_UNAVAILABLE",
  providerTimeout: "AVATAR_PROVIDER_TIMEOUT",
  invalidProviderOutput: "AVATAR_RENDER_INVALID_OUTPUT",
  taskCreateFailed: "AVATAR_RENDER_TASK_CREATE_FAILED",
  storageError: "AVATAR_RENDER_STORAGE_ERROR",
} as const;

export type AvatarRenderErrorCode =
  (typeof AVATAR_RENDER_ERROR_CODES)[keyof typeof AVATAR_RENDER_ERROR_CODES];

export const AVATAR_RENDER_ERROR_MESSAGES: Record<AvatarRenderErrorCode, string> = {
  [AVATAR_RENDER_ERROR_CODES.jobNotFound]: "视频任务不存在",
  [AVATAR_RENDER_ERROR_CODES.renderRequestNotFound]: "数字人渲染请求不存在",
  [AVATAR_RENDER_ERROR_CODES.previewNotWaitingApproval]: "预览渲染不在等待确认状态",
  [AVATAR_RENDER_ERROR_CODES.workerInputInvalid]: "数字人渲染节点输入无效",
  [AVATAR_RENDER_ERROR_CODES.avatarNotReady]: "数字人不可用",
  [AVATAR_RENDER_ERROR_CODES.avatarLicenseNotApproved]: "数字人未授权",
  [AVATAR_RENDER_ERROR_CODES.ttsAudioNotFound]: "TTS 音频不存在",
  [AVATAR_RENDER_ERROR_CODES.aspectRatioMismatch]: "渲染画面比例与项目不一致",
  [AVATAR_RENDER_ERROR_CODES.providerUnavailable]: "本地数字人渲染服务不可用",
  [AVATAR_RENDER_ERROR_CODES.providerTimeout]: "数字人渲染服务超时",
  [AVATAR_RENDER_ERROR_CODES.invalidProviderOutput]: "数字人渲染输出无效",
  [AVATAR_RENDER_ERROR_CODES.taskCreateFailed]: "预览渲染任务创建失败",
  [AVATAR_RENDER_ERROR_CODES.storageError]: "数字人渲染产物存储失败",
};
