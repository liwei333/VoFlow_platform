import type { LocalLlmServiceConfig } from "@/services/scriptLlmProvider";
import type { PublishPlatform, PublishPlatformRule } from "@/lib/publish/rules";

export interface GeneratePublishDraftInput {
  script: string;
  platform: PublishPlatform;
  platformLabel: string;
  rule: PublishPlatformRule;
}

export interface GeneratePublishDraftOptions {
  maxTokens?: number;
  temperature?: number;
  traceId?: string;
}

export interface GeneratePublishDraftResult {
  modelName: string;
  title: string;
  description: string;
  tags: string[];
  topics: string[];
}

export interface PublishDraftLlmProvider {
  generateDraft(
    input: GeneratePublishDraftInput,
    options?: GeneratePublishDraftOptions
  ): Promise<GeneratePublishDraftResult>;
}

export interface CreateLocalPublishDraftLlmProviderInput {
  service: LocalLlmServiceConfig;
  fetcher?: typeof fetch;
}

export function createLocalPublishDraftLlmProvider(
  input: CreateLocalPublishDraftLlmProviderInput
): PublishDraftLlmProvider {
  const { service, fetcher = fetch } = input;
  const baseUrl = service.baseUrl.replace(/\/$/, "");

  return {
    async generateDraft(draftInput, options = {}) {
      const content = await postChatCompletion({
        service,
        baseUrl,
        fetcher,
        messages: buildPublishDraftMessages(draftInput),
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        traceId: options.traceId,
      });

      return parsePublishDraftContent(content, service.modelName);
    },
  };
}

function buildPublishDraftMessages(input: GeneratePublishDraftInput) {
  return [
    {
      role: "system" as const,
      content: "你是短视频发布信息生成助手。只输出 JSON，不要输出解释。",
    },
    {
      role: "user" as const,
      content: [
        `请为 ${input.platformLabel} 生成一份发布草稿。`,
        `标题最多 ${input.rule.title.maxChars} 字。`,
        `标签最多 ${input.rule.tags.maxCount} 个。`,
        `封面比例建议 ${input.rule.cover.recommendedAspectRatio}，允许 ${input.rule.cover.allowedAspectRatios.join("、")}。`,
        `视频时长范围 ${input.rule.video.minDurationSeconds}-${input.rule.video.maxDurationSeconds} 秒。`,
        '输出格式: {"title":"...","description":"...","tags":["..."],"topics":["..."]}',
        `最终文案: ${input.script}`,
      ].join("\n"),
    },
  ];
}

async function postChatCompletion(input: {
  service: LocalLlmServiceConfig;
  baseUrl: string;
  fetcher: typeof fetch;
  messages: Array<{ role: "system" | "user"; content: string }>;
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
    throw new PublishDraftLlmProviderError(
      "PUBLISH_DRAFT_LLM_REQUEST_FAILED",
      `发布草稿生成请求失败: HTTP ${response.status}`
    );
  }

  const payload = await response.json();
  return getChoiceContent(payload);
}

function getChoiceContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new PublishDraftLlmProviderError("PUBLISH_DRAFT_LLM_INVALID_RESPONSE", "发布草稿生成响应无效");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    throw new PublishDraftLlmProviderError(
      "PUBLISH_DRAFT_LLM_INVALID_RESPONSE",
      "发布草稿生成响应缺少 choices"
    );
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== "object") {
    throw new PublishDraftLlmProviderError(
      "PUBLISH_DRAFT_LLM_INVALID_RESPONSE",
      "发布草稿生成响应缺少候选内容"
    );
  }

  const message = (firstChoice as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    throw new PublishDraftLlmProviderError(
      "PUBLISH_DRAFT_LLM_INVALID_RESPONSE",
      "发布草稿生成响应缺少 message"
    );
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new PublishDraftLlmProviderError("PUBLISH_DRAFT_LLM_INVALID_RESPONSE", "发布草稿生成内容为空");
  }

  return content;
}

function parsePublishDraftContent(content: string, modelName: string): GeneratePublishDraftResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    throw new PublishDraftLlmProviderError("PUBLISH_DRAFT_LLM_INVALID_RESPONSE", "发布草稿生成内容不是 JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PublishDraftLlmProviderError("PUBLISH_DRAFT_LLM_INVALID_RESPONSE", "发布草稿生成 JSON 无效");
  }

  const value = parsed as Record<string, unknown>;
  const title = readString(value.title);
  const description = readString(value.description);

  if (!title || !description) {
    throw new PublishDraftLlmProviderError("PUBLISH_DRAFT_LLM_INVALID_RESPONSE", "发布草稿生成字段缺失");
  }

  return {
    modelName,
    title,
    description,
    tags: readStringArray(value.tags),
    topics: readStringArray(value.topics),
  };
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return fenced?.[1]?.trim() ?? trimmed;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export class PublishDraftLlmProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PublishDraftLlmProviderError";
    this.code = code;
  }
}
