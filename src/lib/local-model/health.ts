import {
  LOCAL_MODEL_ERROR_CODES,
  LocalModelServiceConfig,
  LocalModelServiceStatus,
  LocalModelServiceType,
} from "@/lib/local-model/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchLikeResponse>;
type CommandRunner = (
  command: string,
  args: string[],
  options?: { signal?: AbortSignal }
) => Promise<{ stdout: string; stderr?: string }>;

export interface LocalModelHealthOptions {
  fetcher?: FetchLike;
  commandRunner?: CommandRunner;
  timeoutMs?: number;
  now?: () => number;
  monotonicNow?: () => number;
}

export interface LocalModelHealthResult {
  type: LocalModelServiceType;
  status: LocalModelServiceStatus;
  latencyMs?: number;
  checkedAt: Date;
  errorCode?: string;
  errorMessage?: string;
}

const DEFAULT_HEALTH_TIMEOUT_MS = 3000;
const execFileAsync = promisify(execFile);

function createErrorResult(
  service: LocalModelServiceConfig,
  status: LocalModelServiceStatus,
  errorCode: string,
  errorMessage: string,
  checkedAt: Date,
  latencyMs?: number
): LocalModelHealthResult {
  return {
    type: service.type,
    status,
    ...(latencyMs === undefined ? {} : { latencyMs }),
    checkedAt,
    errorCode,
    errorMessage,
  };
}

function getHealthEndpoint(service: LocalModelServiceConfig): string {
  const baseUrl = service.baseUrl?.replace(/\/$/, "");
  if (service.type === "llm") {
    return `${baseUrl}/v1/models`;
  }
  return `${baseUrl}/health`;
}

async function runCommand(command: string, args: string[], options?: { signal?: AbortSignal }) {
  const result = await execFileAsync(command, args, options);
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function responseContainsModel(payload: unknown, modelName: string): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = "data" in payload ? (payload as { data?: unknown }).data : undefined;
  if (!Array.isArray(data)) return false;
  return data.some((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as { id?: unknown }).id === modelName;
  });
}

export async function checkLocalModelService(
  service: LocalModelServiceConfig,
  options: LocalModelHealthOptions = {}
): Promise<LocalModelHealthResult> {
  const checkedAt = new Date((options.now ?? Date.now)());
  if (!service.baseUrl) {
    return createErrorResult(
      service,
      "misconfigured",
      LOCAL_MODEL_ERROR_CODES.misconfigured,
      `${service.name} 服务地址未配置`,
      checkedAt
    );
  }

  const fetcher = options.fetcher ?? fetch;
  const commandRunner = options.commandRunner ?? runCommand;
  const monotonicNow = options.monotonicNow ?? (() => Date.now());
  const start = monotonicNow();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS);

  try {
    if (service.type === "ffmpeg") {
      const result = await commandRunner(service.baseUrl, ["-version"], { signal: controller.signal });
      const latencyMs = Math.max(0, Math.round(monotonicNow() - start));
      if (!result.stdout.toLowerCase().includes("ffmpeg")) {
        return createErrorResult(
          service,
          "offline",
          LOCAL_MODEL_ERROR_CODES.offline,
          "FFmpeg 版本输出无效",
          checkedAt,
          latencyMs
        );
      }
      return {
        type: service.type,
        status: "online",
        latencyMs,
        checkedAt,
      };
    }

    const response = await fetcher(getHealthEndpoint(service), { signal: controller.signal });
    const latencyMs = Math.max(0, Math.round(monotonicNow() - start));

    if (!response.ok) {
      return createErrorResult(
        service,
        response.status === 503 ? "busy" : "offline",
        LOCAL_MODEL_ERROR_CODES.offline,
        `服务返回 HTTP ${response.status}`,
        checkedAt,
        latencyMs
      );
    }

    if (service.type === "llm" && service.modelName && response.json) {
      const payload = await response.json();
      if (!responseContainsModel(payload, service.modelName)) {
        return createErrorResult(
          service,
          "offline",
          LOCAL_MODEL_ERROR_CODES.modelNotLoaded,
          `模型 ${service.modelName} 未加载`,
          checkedAt,
          latencyMs
        );
      }
    }

    return {
      type: service.type,
      status: "online",
      latencyMs,
      checkedAt,
    };
  } catch (error) {
    const latencyMs = Math.max(0, Math.round(monotonicNow() - start));
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return createErrorResult(
      service,
      "offline",
      isTimeout ? LOCAL_MODEL_ERROR_CODES.timeout : LOCAL_MODEL_ERROR_CODES.offline,
      error instanceof Error ? error.message : String(error),
      checkedAt,
      latencyMs
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkLocalModelServices(
  services: LocalModelServiceConfig[],
  options: LocalModelHealthOptions = {}
): Promise<LocalModelHealthResult[]> {
  return Promise.all(services.map((service) => checkLocalModelService(service, options)));
}
