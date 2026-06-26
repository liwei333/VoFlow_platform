export const EXPORT_WORKFLOW_NODE_TYPES = {
  subtitle: "subtitle",
  bgmMix: "bgm_mix",
  cover: "cover",
  finalExport: "final_export",
} as const;

export const EXPORT_ARTIFACT_TYPES = {
  subtitle: "subtitle",
  cover: "cover",
  finalVideo: "final_video",
  mixedAudio: "mixed_audio",
} as const;

export const EXPORT_SUBTITLE_FORMAT = "srt";
export const EXPORT_SUBTITLE_FILE_NAME = "subtitle.srt";
export const EXPORT_SUBTITLE_CONTENT_TYPE = "application/x-subrip";
export const EXPORT_ASS_SUBTITLE_FORMAT = "ass";
export const EXPORT_ASS_SUBTITLE_FILE_NAME = "subtitle.ass";
export const EXPORT_ASS_SUBTITLE_CONTENT_TYPE = "text/x-ass";

export const EXPORT_MIXED_AUDIO_FILE_NAME = "mixed_audio.wav";
export const EXPORT_MIXED_AUDIO_CONTENT_TYPE = "audio/wav";
export const EXPORT_COVER_BASE_FILE_NAME = "cover_base.jpg";
export const EXPORT_COVER_TITLE_FILE_NAME = "cover_title.jpg";
export const EXPORT_COVER_CONTENT_TYPE = "image/jpeg";
export const EXPORT_FINAL_VIDEO_FILE_NAME = "final_video.mp4";
export const EXPORT_FINAL_VIDEO_CONTENT_TYPE = "video/mp4";
export const EXPORT_DOWNLOAD_URL_EXPIRES_SECONDS = 300;

export const EXPORT_OUTPUT_PROFILES = {
  mp4_720p: {
    width: 720,
    height: 1280,
  },
  mp4_1080p: {
    width: 1080,
    height: 1920,
  },
} as const;

export const EXPORT_COVER_FRAME_DEFAULTS = {
  fallbackFrameTimeSeconds: 1,
  jpegQuality: 2,
} as const;

export const EXPORT_COVER_TITLE_DEFAULTS = {
  maxTitleLength: 20,
  overlayY: 1320,
  overlayHeight: 360,
  overlayColor: "black@0.45",
  fontColor: "white",
  fontSize: 64,
  lineSpacing: 12,
  textY: "h-420",
} as const;

export const EXPORT_MEDIA_VALIDATION_LIMITS = {
  durationToleranceMs: 1000,
} as const;

export const EXPORT_REAL_MEDIA_SMOKE_DEFAULTS = {
  durationSeconds: 1.2,
  inputWidth: 540,
  inputHeight: 960,
  frameRate: 25,
  sineFrequencyHz: 660,
  subtitleText: "VoFlow export smoke subtitle.",
} as const;

export const EXPORT_AUDIO_MIX_DEFAULTS = {
  voiceVolume: 100,
  bgmVolume: 35,
  fadeDurationSeconds: 1.5,
  duckingThreshold: 0.05,
  duckingRatio: 8,
  duckingAttackMs: 20,
  duckingReleaseMs: 250,
} as const;

export const EXPORT_SUBTITLE_TIMING = {
  maxCharsPerCue: 18,
  charsPerSecond: 8,
  minCueDurationMs: 1200,
  maxCueDurationMs: 3200,
} as const;

export const EXPORT_ASS_SCRIPT_RESOLUTION = {
  width: 1080,
  height: 1920,
} as const;

export const EXPORT_ASS_SUBTITLE_STYLE = {
  name: "Default",
  fontName: "Noto Sans CJK SC",
  fontSize: 52,
  primaryColor: "&H00FFFFFF",
  secondaryColor: "&H000000FF",
  outlineColor: "&H00000000",
  backColor: "&H64000000",
  bold: 0,
  italic: 0,
  underline: 0,
  strikeOut: 0,
  scaleX: 100,
  scaleY: 100,
  spacing: 0,
  angle: 0,
  borderStyle: 1,
  outline: 3,
  shadow: 0,
  alignment: 2,
  marginL: 72,
  marginR: 72,
  marginV: 300,
  encoding: 1,
} as const;

export const EXPORT_ERROR_CODES = {
  subtitleSourceNotFound: "SUBTITLE_SOURCE_NOT_FOUND",
  subtitleGenerationFailed: "SUBTITLE_GENERATION_FAILED",
  bgmAssetNotFound: "BGM_ASSET_NOT_FOUND",
  bgmAssetTypeUnsupported: "BGM_ASSET_TYPE_UNSUPPORTED",
  bgmLicenseNotApproved: "BGM_LICENSE_NOT_APPROVED",
  bgmMixFailed: "BGM_MIX_FAILED",
  coverFrameExtractionFailed: "COVER_FRAME_EXTRACTION_FAILED",
  exportFfmpegFailed: "EXPORT_FFMPEG_FAILED",
  exportMediaValidationFailed: "EXPORT_MEDIA_VALIDATION_FAILED",
  exportJobNotFound: "EXPORT_JOB_NOT_FOUND",
  exportInputNotReady: "EXPORT_INPUT_NOT_READY",
  finalVideoNotFound: "FINAL_VIDEO_NOT_FOUND",
} as const;

export const EXPORT_ERROR_MESSAGES = {
  [EXPORT_ERROR_CODES.subtitleSourceNotFound]: "缺少已确认文案或 TTS 音频",
  [EXPORT_ERROR_CODES.subtitleGenerationFailed]: "字幕生成失败",
  [EXPORT_ERROR_CODES.bgmAssetNotFound]: "BGM 素材不存在",
  [EXPORT_ERROR_CODES.bgmAssetTypeUnsupported]: "BGM 素材仅支持音频",
  [EXPORT_ERROR_CODES.bgmLicenseNotApproved]: "BGM 素材未授权",
  [EXPORT_ERROR_CODES.bgmMixFailed]: "BGM 混音失败",
  [EXPORT_ERROR_CODES.coverFrameExtractionFailed]: "封面抽帧失败",
  [EXPORT_ERROR_CODES.exportFfmpegFailed]: "最终视频合成失败",
  [EXPORT_ERROR_CODES.exportMediaValidationFailed]: "最终 MP4 验收失败",
  [EXPORT_ERROR_CODES.exportJobNotFound]: "视频任务不存在",
  [EXPORT_ERROR_CODES.exportInputNotReady]: "导出所需上游产物未准备完成",
  [EXPORT_ERROR_CODES.finalVideoNotFound]: "最终视频不存在",
} as const;
