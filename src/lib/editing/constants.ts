import type { EditingPipPosition } from "@prisma/client";

export const EDITING_PREVIEW_NODE_TYPE = "editing_preview";
export const EDITING_PREVIEW_ARTIFACT_TYPE = "editing_preview";
export const EDITING_PREVIEW_CONTENT_TYPE = "application/json";
export const EDITING_PREVIEW_FILE_EXTENSION = "json";

export const EDITING_PIP_POSITIONS = [
  "top_left",
  "top_right",
  "bottom_left",
  "bottom_right",
] as const satisfies readonly EditingPipPosition[];

export const DEFAULT_EDITING_CONFIG = {
  subtitleEnabled: true,
  keywordHighlightEnabled: false,
  bgmDuckingEnabled: true,
  pipEnabled: false,
  pipAssetId: null,
  pipPosition: "top_right",
  pipSize: 25,
  backgroundAssetId: null,
  voiceVolume: 100,
  bgmVolume: 35,
  transitionStrength: 50,
  configJson: null,
  previewArtifactId: null,
} as const satisfies {
  subtitleEnabled: boolean;
  keywordHighlightEnabled: boolean;
  bgmDuckingEnabled: boolean;
  pipEnabled: boolean;
  pipAssetId: string | null;
  pipPosition: EditingPipPosition;
  pipSize: number;
  backgroundAssetId: string | null;
  voiceVolume: number;
  bgmVolume: number;
  transitionStrength: number;
  configJson: null;
  previewArtifactId: string | null;
};

export const EDITING_RANGE_LIMITS = {
  pipSize: {
    min: 10,
    max: 60,
  },
  volume: {
    min: 0,
    max: 100,
  },
  transitionStrength: {
    min: 0,
    max: 100,
  },
} as const;

export const EDITING_KEYWORD_HIGHLIGHT_LIMITS = {
  maxKeywords: 5,
  minKeywordLength: 2,
  maxKeywordLength: 8,
} as const;

export const EDITING_KEYWORD_HIGHLIGHT_ASS_STYLE = {
  styleName: "KeywordHighlight",
  primaryColor: "&H0000D7FF",
  outlineColor: "&H00000000",
  bold: true,
} as const;

export const EDITING_ERROR_CODES = {
  jobNotFound: "EDITING_JOB_NOT_FOUND",
  configQueryFailed: "EDITING_CONFIG_QUERY_FAILED",
  configSaveFailed: "EDITING_CONFIG_SAVE_FAILED",
  pipAssetLicenseNotApproved: "PIP_ASSET_LICENSE_NOT_APPROVED",
  pipAssetTypeUnsupported: "PIP_ASSET_TYPE_UNSUPPORTED",
  backgroundAssetLicenseNotApproved: "BACKGROUND_ASSET_LICENSE_NOT_APPROVED",
  backgroundAssetTypeUnsupported: "BACKGROUND_ASSET_TYPE_UNSUPPORTED",
  previewFailed: "EDITING_PREVIEW_FAILED",
} as const;

export type EditingErrorCode =
  (typeof EDITING_ERROR_CODES)[keyof typeof EDITING_ERROR_CODES];

export const EDITING_ERROR_MESSAGES: Record<EditingErrorCode, string> = {
  [EDITING_ERROR_CODES.jobNotFound]: "视频任务不存在",
  [EDITING_ERROR_CODES.configQueryFailed]: "剪辑配置查询失败",
  [EDITING_ERROR_CODES.configSaveFailed]: "剪辑配置保存失败",
  [EDITING_ERROR_CODES.pipAssetLicenseNotApproved]: "画中画素材未授权",
  [EDITING_ERROR_CODES.pipAssetTypeUnsupported]: "画中画素材仅支持图片或视频",
  [EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved]: "背景素材未授权",
  [EDITING_ERROR_CODES.backgroundAssetTypeUnsupported]: "背景素材仅支持图片或视频",
  [EDITING_ERROR_CODES.previewFailed]: "剪辑预览生成失败",
};
