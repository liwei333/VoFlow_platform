export type LocalModelServiceType = "llm" | "asr" | "tts" | "avatar" | "ffmpeg";
export type LocalModelServiceStatus = "online" | "offline" | "busy" | "misconfigured";

export const LOCAL_MODEL_ERROR_CODES = {
  misconfigured: "LOCAL_SERVICE_MISCONFIGURED",
  timeout: "LOCAL_SERVICE_TIMEOUT",
  modelNotLoaded: "LOCAL_MODEL_NOT_LOADED",
  offline: "LOCAL_SERVICE_OFFLINE",
} as const;

export interface LocalModelError {
  errorCode: (typeof LOCAL_MODEL_ERROR_CODES)[keyof typeof LOCAL_MODEL_ERROR_CODES];
  errorMessage: string;
}

export interface LocalModelServiceConfig {
  type: LocalModelServiceType;
  name: string;
  baseUrl?: string;
  modelName?: string;
  status: LocalModelServiceStatus;
  lastError?: LocalModelError;
}

interface LocalModelServiceDefinition {
  type: LocalModelServiceType;
  name: string;
  baseUrlEnv: string;
  modelNameEnv?: string;
}

export const LOCAL_MODEL_SERVICE_DEFINITIONS: LocalModelServiceDefinition[] = [
  { type: "llm", name: "本地 LLM", baseUrlEnv: "LLM_BASE_URL", modelNameEnv: "LLM_MODEL" },
  { type: "asr", name: "ASR 转写", baseUrlEnv: "ASR_BASE_URL" },
  { type: "tts", name: "TTS 语音", baseUrlEnv: "TTS_BASE_URL" },
  { type: "avatar", name: "数字人渲染", baseUrlEnv: "AVATAR_BASE_URL" },
  { type: "ffmpeg", name: "FFmpeg", baseUrlEnv: "FFMPEG_WORKER" },
];

export const LOCAL_MODEL_ENV_EXAMPLES = [
  { key: "LLM_BASE_URL", value: "http://localhost:8000" },
  { key: "LLM_MODEL", value: "qwen2.5" },
  { key: "ASR_BASE_URL", value: "http://localhost:6000" },
  { key: "TTS_BASE_URL", value: "http://localhost:5000" },
  { key: "AVATAR_BASE_URL", value: "http://localhost:7000" },
  { key: "FFMPEG_WORKER", value: "/usr/local/bin/ffmpeg" },
  { key: "GPU_MODE", value: "auto" },
  { key: "QUEUE_REDIS_URL", value: "redis://localhost:6379" },
] as const;

export type LocalModelEnv = Record<string, string | undefined>;

function readEnvValue(env: LocalModelEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function buildLocalModelServiceConfigs(env: LocalModelEnv = process.env): LocalModelServiceConfig[] {
  return LOCAL_MODEL_SERVICE_DEFINITIONS.map((definition) => {
    const baseUrl = readEnvValue(env, definition.baseUrlEnv);
    const modelName = definition.modelNameEnv ? readEnvValue(env, definition.modelNameEnv) : undefined;

    if (!baseUrl) {
      return {
        type: definition.type,
        name: definition.name,
        modelName,
        status: "misconfigured",
        lastError: {
          errorCode: LOCAL_MODEL_ERROR_CODES.misconfigured,
          errorMessage: `${definition.baseUrlEnv} 未配置`,
        },
      };
    }

    return {
      type: definition.type,
      name: definition.name,
      baseUrl,
      modelName,
      status: "offline",
    };
  });
}
