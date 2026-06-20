import { buildRewriteScriptPrompt, type ScriptPromptMessage } from "@/lib/scripts/promptTemplates";

export const LOCAL_OPENAI_COMPATIBLE_PROVIDER = "local-openai-compatible";

export interface LocalLlmServiceConfig {
  baseUrl: string;
  modelName: string;
}

export interface RewriteScriptInput {
  script: string;
  platform?: string;
  tone?: string;
  durationSeconds?: number;
  forbiddenWords?: string[];
}

export interface RewriteScriptOptions {
  candidateCount?: number;
  maxTokens?: number;
  temperature?: number;
  traceId?: string;
}

export interface RewriteScriptResult {
  provider: typeof LOCAL_OPENAI_COMPATIBLE_PROVIDER;
  modelName: string;
  candidates: string[];
}

export interface GenerateTitlesOptions {
  titleCount?: number;
  maxTokens?: number;
  temperature?: number;
  traceId?: string;
}

export interface GenerateTitlesResult {
  provider: typeof LOCAL_OPENAI_COMPATIBLE_PROVIDER;
  modelName: string;
  titles: string[];
}

export interface LlmProviderHealthResult {
  provider: typeof LOCAL_OPENAI_COMPATIBLE_PROVIDER;
  modelName: string;
  status: "online" | "offline";
  latencyMs: number;
  error?: string;
}

export interface ScriptLlmProvider {
  rewriteScript(input: RewriteScriptInput, options?: RewriteScriptOptions): Promise<RewriteScriptResult>;
  generateTitles(script: string, platform: string, options?: GenerateTitlesOptions): Promise<GenerateTitlesResult>;
  healthCheck(): Promise<LlmProviderHealthResult>;
}

export interface CreateLocalOpenAiCompatibleLlmProviderInput {
  service: LocalLlmServiceConfig;
  fetcher?: typeof fetch;
  now?: () => number;
}

export function createLocalOpenAiCompatibleLlmProvider(
  input: CreateLocalOpenAiCompatibleLlmProviderInput
): ScriptLlmProvider {
  const { service, fetcher = fetch, now = Date.now } = input;
  const baseUrl = service.baseUrl.replace(/\/$/, "");

  return {
    async rewriteScript(scriptInput, options = {}) {
      const content = await postChatCompletion({
        service,
        baseUrl,
        fetcher,
        messages: buildRewriteScriptPrompt({
          ...scriptInput,
          candidateCount: options.candidateCount,
        }).messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        traceId: options.traceId,
      });

      return {
        provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
        modelName: service.modelName,
        candidates: parseStringList(content, "candidates"),
      };
    },

    async generateTitles(script, platform, options = {}) {
      const content = await postChatCompletion({
        service,
        baseUrl,
        fetcher,
        messages: buildTitleMessages(script, platform, options),
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        traceId: options.traceId,
      });

      return {
        provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
        modelName: service.modelName,
        titles: parseStringList(content, "titles"),
      };
    },

    async healthCheck() {
      const startedAt = now();

      try {
        const response = await fetcher(`${baseUrl}/v1/models`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });
        const latencyMs = now() - startedAt;

        if (!response.ok) {
          return {
            provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
            modelName: service.modelName,
            status: "offline",
            latencyMs,
            error: `HTTP ${response.status}`,
          };
        }

        const payload = await response.json();
        if (!responseContainsModel(payload, service.modelName)) {
          return {
            provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
            modelName: service.modelName,
            status: "offline",
            latencyMs,
            error: `模型 ${service.modelName} 未加载`,
          };
        }

        return {
          provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
          modelName: service.modelName,
          status: "online",
          latencyMs,
        };
      } catch (error) {
        return {
          provider: LOCAL_OPENAI_COMPATIBLE_PROVIDER,
          modelName: service.modelName,
          status: "offline",
          latencyMs: now() - startedAt,
          error: error instanceof Error ? error.message : "LLM 健康检查失败",
        };
      }
    },
  };
}

async function postChatCompletion(input: {
  service: LocalLlmServiceConfig;
  baseUrl: string;
  fetcher: typeof fetch;
  messages: ScriptPromptMessage[];
  maxTokens?: number;
  temperature?: number;
  traceId?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: input.service.modelName,
    messages: input.messages,
    temperature: input.temperature ?? 0.7,
  };

  if (input.maxTokens !== undefined) {
    body.max_tokens = input.maxTokens;
  }

  const response = await input.fetcher(`${input.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.traceId ? { "X-Trace-Id": input.traceId } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new LlmProviderError("LOCAL_LLM_REQUEST_FAILED", `LLM 请求失败: HTTP ${response.status}`);
  }

  const payload = await response.json();
  return getChoiceContent(payload);
}

function buildTitleMessages(
  script: string,
  platform: string,
  options: GenerateTitlesOptions
): ScriptPromptMessage[] {
  const titleCount = options.titleCount ?? 5;

  return [
    {
      role: "system",
      content: "你是短视频标题生成助手。只输出 JSON。",
    },
    {
      role: "user",
      content: [
        `请为 ${platform} 生成不少于 ${titleCount} 个标题。`,
        "输出格式: {\"titles\":[\"...\"]}",
        `文案: ${script}`,
      ].join("\n"),
    },
  ];
}

function getChoiceContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应无效");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应缺少 choices");
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应缺少候选内容");
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应缺少 message");
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应内容为空");
  }

  return content;
}

function parseStringList(content: string, key: "candidates" | "titles"): string[] {
  try {
    const parsed = JSON.parse(content);
    const values = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)[key];
    if (Array.isArray(values)) {
      return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    }
  } catch {
    const values = content
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-\d.、]+\s*/, "").trim())
      .filter(Boolean);
    if (values.length > 0) {
      return values;
    }
  }

  throw new LlmProviderError("LOCAL_LLM_INVALID_RESPONSE", "LLM 响应无法解析为候选列表");
}

function responseContainsModel(payload: unknown, modelName: string): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) && data.some((item) => {
    return Boolean(item && typeof item === "object" && (item as { id?: unknown }).id === modelName);
  });
}

export class LlmProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "LlmProviderError";
    this.code = code;
  }
}
