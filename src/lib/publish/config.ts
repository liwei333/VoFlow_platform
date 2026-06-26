export const PUBLISH_REAL_PLATFORM_PROVIDERS = {
  youtube: "youtube",
} as const;

export const PUBLISH_REAL_PLATFORM_ERROR_CODES = {
  notConfigured: "PUBLISH_REAL_PLATFORM_NOT_CONFIGURED",
} as const;

export const PUBLISH_REAL_PLATFORM_ENV_EXAMPLES: PublishRealPlatformEnvExample[] = [
  {
    key: "PUBLISH_REAL_ADAPTER_ENABLED",
    value: "false",
    description: "是否启用真实平台发布 Adapter",
  },
  {
    key: "PUBLISH_REAL_PROVIDER",
    value: PUBLISH_REAL_PLATFORM_PROVIDERS.youtube,
    description: "首个真实发布平台提供方",
  },
  {
    key: "PUBLISH_ALLOW_MOCK_ADAPTER",
    value: "true",
    description: "本地开发是否允许显式使用 mock Adapter",
  },
  {
    key: "YOUTUBE_CLIENT_ID",
    value: "",
    description: "Google Cloud OAuth client id",
  },
  {
    key: "YOUTUBE_CLIENT_SECRET",
    value: "",
    description: "Google Cloud OAuth client secret",
  },
  {
    key: "YOUTUBE_REDIRECT_URI",
    value: "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
    description: "YouTube OAuth 回调地址",
  },
  {
    key: "YOUTUBE_API_BASE_URL",
    value: "https://www.googleapis.com/youtube/v3",
    description: "YouTube Data API base URL",
  },
  {
    key: "YOUTUBE_UPLOAD_BASE_URL",
    value: "https://www.googleapis.com/upload/youtube/v3",
    description: "YouTube resumable upload base URL",
  },
  {
    key: "YOUTUBE_OAUTH_AUTH_URL",
    value: "https://accounts.google.com/o/oauth2/v2/auth",
    description: "YouTube OAuth authorize URL",
  },
  {
    key: "YOUTUBE_OAUTH_TOKEN_URL",
    value: "https://oauth2.googleapis.com/token",
    description: "YouTube OAuth token URL",
  },
  {
    key: "YOUTUBE_DEFAULT_PRIVACY_STATUS",
    value: "private",
    description: "YouTube 默认公开视频可见性",
  },
  {
    key: "YOUTUBE_DEFAULT_CATEGORY_ID",
    value: "22",
    description: "YouTube 默认分类 ID",
  },
  {
    key: "YOUTUBE_NOTIFY_SUBSCRIBERS",
    value: "false",
    description: "YouTube 发布时是否通知订阅者",
  },
  {
    key: "YOUTUBE_UPLOAD_SCOPE",
    value: "https://www.googleapis.com/auth/youtube.upload",
    description: "YouTube 上传授权 scope",
  },
  {
    key: "YOUTUBE_READONLY_SCOPE",
    value: "https://www.googleapis.com/auth/youtube.readonly",
    description: "YouTube 账号读取授权 scope",
  },
];

export const PUBLISH_REAL_PLATFORM_REQUIRED_ENV_KEYS = [
  "CHANNEL_TOKEN_ENCRYPTION_SECRET",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "YOUTUBE_REDIRECT_URI",
] as const;

export type PublishRealPlatformProvider =
  (typeof PUBLISH_REAL_PLATFORM_PROVIDERS)[keyof typeof PUBLISH_REAL_PLATFORM_PROVIDERS];

export type PublishRealPlatformErrorCode =
  (typeof PUBLISH_REAL_PLATFORM_ERROR_CODES)[keyof typeof PUBLISH_REAL_PLATFORM_ERROR_CODES];

export type PublishRealPlatformEnv = Record<string, string | undefined>;

export interface PublishRealPlatformEnvExample {
  key: string;
  value: string;
  description: string;
}

export interface PublishRealPlatformValidation {
  passed: boolean;
  missingEnvKeys: string[];
  error?: {
    code: PublishRealPlatformErrorCode;
    message: string;
  };
}

export interface PublishYoutubeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  apiBaseUrl: string;
  uploadBaseUrl: string;
  oauthAuthorizationUrl: string;
  oauthTokenUrl: string;
  defaultPrivacyStatus: string;
  defaultCategoryId: string;
  notifySubscribers: boolean;
  scopes: string[];
}

export interface PublishRealPlatformConfig {
  realAdapterEnabled: boolean;
  provider: PublishRealPlatformProvider;
  allowMockAdapter: boolean;
  youtube: PublishYoutubeConfig;
  validation: PublishRealPlatformValidation;
}

export class PublishRealPlatformConfigError extends Error {
  readonly code = PUBLISH_REAL_PLATFORM_ERROR_CODES.notConfigured;
  readonly missingEnvKeys: string[];

  constructor(message: string, missingEnvKeys: string[] = []) {
    super(message);
    this.name = "PublishRealPlatformConfigError";
    this.missingEnvKeys = missingEnvKeys;
  }
}

export function buildPublishRealPlatformConfig(
  env: PublishRealPlatformEnv = process.env
): PublishRealPlatformConfig {
  const realAdapterEnabled = readBooleanEnv(env.PUBLISH_REAL_ADAPTER_ENABLED, false);
  const provider = readProvider(env.PUBLISH_REAL_PROVIDER);
  const allowMockAdapter = readBooleanEnv(env.PUBLISH_ALLOW_MOCK_ADAPTER, true);
  const youtube = buildPublishYoutubeConfig(env);
  const missingEnvKeys = realAdapterEnabled ? collectMissingRequiredEnvKeys(env) : [];
  const validation = buildValidation(missingEnvKeys);

  return {
    realAdapterEnabled,
    provider,
    allowMockAdapter,
    youtube,
    validation,
  };
}

export function assertPublishRealPlatformConfigured(
  env: PublishRealPlatformEnv = process.env
): PublishRealPlatformConfig {
  const config = buildPublishRealPlatformConfig(env);

  if (!config.validation.passed) {
    throw new PublishRealPlatformConfigError(
      config.validation.error?.message ?? "真实发布配置不完整",
      config.validation.missingEnvKeys
    );
  }

  return config;
}

function buildPublishYoutubeConfig(env: PublishRealPlatformEnv): PublishYoutubeConfig {
  return {
    clientId: readStringEnv(env.YOUTUBE_CLIENT_ID),
    clientSecret: readStringEnv(env.YOUTUBE_CLIENT_SECRET),
    redirectUri: readStringEnv(env.YOUTUBE_REDIRECT_URI),
    apiBaseUrl: readStringEnv(env.YOUTUBE_API_BASE_URL, "https://www.googleapis.com/youtube/v3"),
    uploadBaseUrl: readStringEnv(
      env.YOUTUBE_UPLOAD_BASE_URL,
      "https://www.googleapis.com/upload/youtube/v3"
    ),
    oauthAuthorizationUrl: readStringEnv(
      env.YOUTUBE_OAUTH_AUTH_URL,
      "https://accounts.google.com/o/oauth2/v2/auth"
    ),
    oauthTokenUrl: readStringEnv(env.YOUTUBE_OAUTH_TOKEN_URL, "https://oauth2.googleapis.com/token"),
    defaultPrivacyStatus: readStringEnv(env.YOUTUBE_DEFAULT_PRIVACY_STATUS, "private"),
    defaultCategoryId: readStringEnv(env.YOUTUBE_DEFAULT_CATEGORY_ID, "22"),
    notifySubscribers: readBooleanEnv(env.YOUTUBE_NOTIFY_SUBSCRIBERS, false),
    scopes: [
      readStringEnv(env.YOUTUBE_UPLOAD_SCOPE, "https://www.googleapis.com/auth/youtube.upload"),
      readStringEnv(env.YOUTUBE_READONLY_SCOPE, "https://www.googleapis.com/auth/youtube.readonly"),
    ],
  };
}

function collectMissingRequiredEnvKeys(env: PublishRealPlatformEnv): string[] {
  return PUBLISH_REAL_PLATFORM_REQUIRED_ENV_KEYS.filter((key) => !readStringEnv(env[key]));
}

function buildValidation(missingEnvKeys: string[]): PublishRealPlatformValidation {
  if (missingEnvKeys.length === 0) {
    return {
      passed: true,
      missingEnvKeys,
    };
  }

  return {
    passed: false,
    missingEnvKeys,
    error: {
      code: PUBLISH_REAL_PLATFORM_ERROR_CODES.notConfigured,
      message: `真实发布配置不完整，缺少环境变量：${missingEnvKeys.join(", ")}`,
    },
  };
}

function readProvider(value: string | undefined): PublishRealPlatformProvider {
  return value === PUBLISH_REAL_PLATFORM_PROVIDERS.youtube
    ? PUBLISH_REAL_PLATFORM_PROVIDERS.youtube
    : PUBLISH_REAL_PLATFORM_PROVIDERS.youtube;
}

function readStringEnv(value: string | undefined, fallback = ""): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : fallback;
}

function readBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
}
