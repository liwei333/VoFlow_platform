export const REWRITE_SCRIPT_PROMPT_VERSION = 1;
export const REWRITE_SCRIPT_PROMPT_TYPE = "script_rewrite";

export interface ScriptPromptMessage {
  role: "system" | "user";
  content: string;
}

export interface BuildRewriteScriptPromptInput {
  script: string;
  platform?: string;
  durationSeconds?: number;
  tone?: string;
  forbiddenWords?: string[];
  candidateCount?: number;
}

export interface RewriteScriptPrompt {
  promptType: typeof REWRITE_SCRIPT_PROMPT_TYPE;
  version: typeof REWRITE_SCRIPT_PROMPT_VERSION;
  params: {
    platform: string;
    durationSeconds: number | null;
    tone: string;
    forbiddenWords: string[];
    candidateCount: number;
  };
  messages: ScriptPromptMessage[];
}

export function buildRewriteScriptPrompt(input: BuildRewriteScriptPromptInput): RewriteScriptPrompt {
  const params = {
    platform: normalizeText(input.platform, "通用"),
    durationSeconds: normalizeDuration(input.durationSeconds),
    tone: normalizeText(input.tone, "自然"),
    forbiddenWords: normalizeForbiddenWords(input.forbiddenWords),
    candidateCount: normalizeRewriteCandidateCount(input.candidateCount),
  };

  return {
    promptType: REWRITE_SCRIPT_PROMPT_TYPE,
    version: REWRITE_SCRIPT_PROMPT_VERSION,
    params,
    messages: [
      {
        role: "system",
        content: "你是短视频口播文案改写助手。只输出 JSON，不输出解释。",
      },
      {
        role: "user",
        content: [
          `请生成 ${params.candidateCount} 个口播化候选文案。`,
          `平台: ${params.platform}`,
          params.durationSeconds ? `目标时长: ${params.durationSeconds} 秒` : "目标时长: 未指定",
          `语气: ${params.tone}`,
          `禁用词: ${params.forbiddenWords.length > 0 ? params.forbiddenWords.join(",") : "无"}`,
          "要求: 口播自然、结构清晰、适合真人表达，避免照搬原文句式。",
          "输出格式: {\"candidates\":[\"候选1\",\"候选2\",\"候选3\"]}",
          `原文: ${input.script}`,
        ].join("\n"),
      },
    ],
  };
}

export function normalizeRewriteCandidateCount(candidateCount = 3): number {
  if (!Number.isFinite(candidateCount)) return 3;
  return Math.min(5, Math.max(3, Math.round(candidateCount)));
}

function normalizeText(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function normalizeDuration(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeForbiddenWords(words: string[] | undefined): string[] {
  return [...new Set((words ?? []).map((word) => word.trim()).filter(Boolean))];
}
