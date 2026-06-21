import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { LocalLlmServiceConfig } from "@/services/scriptLlmProvider";
import {
  getScriptAiModelRegistry,
  requireAvailableLlmService,
  type ScriptAiModelRegistry,
} from "@/services/scriptModelRegistryService";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";

export const REFERENCE_STRUCTURE_FAILED = "REFERENCE_STRUCTURE_FAILED";
export const REFERENCE_TRANSCRIPT_NOT_FOUND = "REFERENCE_TRANSCRIPT_NOT_FOUND";
export const REFERENCE_STRUCTURE_INVALID_NODE_INPUT =
  "REFERENCE_STRUCTURE_INVALID_NODE_INPUT";
export const LOCAL_REFERENCE_STRUCTURE_PROVIDER = "local-openai-compatible";

export interface ReferenceStructureSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ReferenceStructure {
  hook: string;
  rhythm: string[];
  sellingPoints: string[];
  targetAudience: string;
}

export interface ReferenceStructureProviderInput {
  transcript: string;
  segments: ReferenceStructureSegment[];
}

export interface ReferenceStructureProviderOptions {
  maxTokens?: number;
  traceId?: string;
}

export interface ReferenceStructureProviderOutput {
  provider: string;
  modelName: string;
  structure: ReferenceStructure;
}

export interface ReferenceStructureProvider {
  analyzeStructure(
    input: ReferenceStructureProviderInput,
    options?: ReferenceStructureProviderOptions
  ): Promise<ReferenceStructureProviderOutput>;
}

export interface ReferenceStructureProviderFactory {
  createProvider(service: LocalLlmServiceConfig): ReferenceStructureProvider;
}

export interface ReferenceStructureRegistryReader {
  getRegistry(): Promise<ScriptAiModelRegistry>;
}

export interface CreateReferenceStructureWorkflowNodeHandlerDependencies {
  registry: ReferenceStructureRegistryReader;
  providerFactory: ReferenceStructureProviderFactory;
}

interface ReferenceStructureWorkflowNodeInput {
  sourceType: "reference_structure";
  referenceSourceId: string;
}

interface ReferenceTranscriptRecord {
  referenceSourceId: string;
  scriptId: string;
  transcript: string;
  segments: ReferenceStructureSegment[];
}

const referenceStructureRegistryReader: ReferenceStructureRegistryReader = {
  getRegistry: getScriptAiModelRegistry,
};

const localReferenceStructureProviderFactory: ReferenceStructureProviderFactory = {
  createProvider(service) {
    return createLocalReferenceStructureProvider({ service });
  },
};

const defaultCreateReferenceStructureWorkflowNodeHandlerDependencies: CreateReferenceStructureWorkflowNodeHandlerDependencies =
  {
    registry: referenceStructureRegistryReader,
    providerFactory: localReferenceStructureProviderFactory,
  };

export function createReferenceStructureWorkflowNodeHandler(
  dependencies: Partial<CreateReferenceStructureWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { registry, providerFactory } = {
    ...defaultCreateReferenceStructureWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const parsedInput = parseReferenceStructureWorkflowNodeInput(input);
    const transcript = await findReferenceTranscript(parsedInput.referenceSourceId);
    if (!transcript) {
      throw new ReferenceStructureWorkerError(
        REFERENCE_TRANSCRIPT_NOT_FOUND,
        "爆款参考原文不存在"
      );
    }

    try {
      const modelRegistry = await registry.getRegistry();
      const llmService = requireAvailableLlmService(modelRegistry.llm);
      const provider = providerFactory.createProvider(llmService);
      const result = await provider.analyzeStructure(
        {
          transcript: transcript.transcript,
          segments: transcript.segments,
        },
        {
          maxTokens: modelRegistry.generation.maxTokens,
          traceId: payload.traceId,
        }
      );
      await saveReferenceStructureResult({
        referenceSourceId: parsedInput.referenceSourceId,
        provider: result.provider,
        modelName: result.modelName,
        structure: result.structure,
      });

      return {
        output: {
          sourceType: parsedInput.sourceType,
          referenceSourceId: parsedInput.referenceSourceId,
          modelName: result.modelName,
          structure: result.structure,
        },
      };
    } catch (error) {
      await markReferenceStructureFailed(parsedInput.referenceSourceId, error);
      throw referenceStructureFailedError(error);
    }
  };
}

export function createLocalReferenceStructureProvider(input: {
  service: LocalLlmServiceConfig;
  fetcher?: typeof fetch;
}): ReferenceStructureProvider {
  const { service, fetcher = fetch } = input;
  const baseUrl = service.baseUrl.replace(/\/$/, "");

  return {
    async analyzeStructure(structureInput, options = {}) {
      const response = await fetcher(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.traceId ? { "X-Trace-Id": options.traceId } : {}),
        },
        body: JSON.stringify({
          model: service.modelName,
          messages: buildReferenceStructureMessages(structureInput),
          temperature: 0.3,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
      });

      if (!response.ok) {
        throw new ReferenceStructureWorkerError(
          REFERENCE_STRUCTURE_FAILED,
          `结构分析 LLM 请求失败: HTTP ${response.status}`
        );
      }

      const payload = await response.json();
      return {
        provider: LOCAL_REFERENCE_STRUCTURE_PROVIDER,
        modelName: service.modelName,
        structure: parseReferenceStructure(getChoiceContent(payload)),
      };
    },
  };
}

async function findReferenceTranscript(
  referenceSourceId: string
): Promise<ReferenceTranscriptRecord | null> {
  const referenceSource = await prisma.referenceSource.findUnique({
    where: {
      id: referenceSourceId,
    },
    select: {
      id: true,
      transcriptScript: {
        select: {
          id: true,
          content: true,
          asrSegments: {
            orderBy: {
              startMs: "asc",
            },
            select: {
              startMs: true,
              endMs: true,
              text: true,
            },
          },
        },
      },
    },
  });

  if (!referenceSource?.transcriptScript) {
    return null;
  }

  return {
    referenceSourceId: referenceSource.id,
    scriptId: referenceSource.transcriptScript.id,
    transcript: referenceSource.transcriptScript.content,
    segments: referenceSource.transcriptScript.asrSegments,
  };
}

async function saveReferenceStructureResult(input: {
  referenceSourceId: string;
  provider: string;
  modelName: string;
  structure: ReferenceStructure;
}): Promise<void> {
  await prisma.referenceSource.update({
    where: {
      id: input.referenceSourceId,
    },
    data: {
      status: "succeeded",
      structureJson: toPrismaJson({
        ...input.structure,
        modelName: input.modelName,
        provider: input.provider,
      }),
      errorJson: Prisma.JsonNull,
    },
  });
}

async function markReferenceStructureFailed(
  referenceSourceId: string,
  error: unknown
): Promise<void> {
  await prisma.referenceSource.update({
    where: {
      id: referenceSourceId,
    },
    data: {
      status: "failed",
      errorJson: toPrismaJson({
        code: REFERENCE_STRUCTURE_FAILED,
        message: "爆款结构分析失败",
        detail: getErrorDetail(error),
      }),
    },
  });
}

function parseReferenceStructureWorkflowNodeInput(
  input: unknown
): ReferenceStructureWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ReferenceStructureWorkerError(
      REFERENCE_STRUCTURE_INVALID_NODE_INPUT,
      "爆款结构分析节点输入无效"
    );
  }

  const value = input as Partial<ReferenceStructureWorkflowNodeInput>;
  if (
    value.sourceType !== "reference_structure" ||
    typeof value.referenceSourceId !== "string"
  ) {
    throw new ReferenceStructureWorkerError(
      REFERENCE_STRUCTURE_INVALID_NODE_INPUT,
      "爆款结构分析节点输入无效"
    );
  }

  return {
    sourceType: value.sourceType,
    referenceSourceId: value.referenceSourceId,
  };
}

function buildReferenceStructureMessages(input: ReferenceStructureProviderInput) {
  return [
    {
      role: "system",
      content:
        "你是短视频爆款结构分析助手。只输出 JSON，不要输出 Markdown。",
    },
    {
      role: "user",
      content: [
        "请从口播原文和分段中提取爆款结构。",
        '输出格式: {"hook":"...","rhythm":["..."],"sellingPoints":["..."],"targetAudience":"..."}',
        `原文: ${input.transcript}`,
        `分段: ${JSON.stringify(input.segments)}`,
      ].join("\n"),
    },
  ];
}

function getChoiceContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 响应无效");
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 响应缺少候选内容");
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 响应缺少 message");
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 响应内容为空");
  }

  return content;
}

function parseReferenceStructure(content: string): ReferenceStructure {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 结构分析 JSON 无效");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 结构分析结果无效");
  }

  const value = parsed as Partial<ReferenceStructure>;
  if (
    typeof value.hook !== "string" ||
    !Array.isArray(value.rhythm) ||
    !Array.isArray(value.sellingPoints) ||
    typeof value.targetAudience !== "string"
  ) {
    throw new ReferenceStructureWorkerError(REFERENCE_STRUCTURE_FAILED, "LLM 结构分析字段缺失");
  }

  return {
    hook: value.hook,
    rhythm: value.rhythm.filter((item): item is string => typeof item === "string"),
    sellingPoints: value.sellingPoints.filter(
      (item): item is string => typeof item === "string"
    ),
    targetAudience: value.targetAudience,
  };
}

function referenceStructureFailedError(error: unknown): ReferenceStructureWorkerError {
  const failedError = new ReferenceStructureWorkerError(
    REFERENCE_STRUCTURE_FAILED,
    "爆款结构分析失败"
  );
  failedError.cause = error;
  return failedError;
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown structure analysis error";
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

class ReferenceStructureWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ReferenceStructureWorkerError";
    this.code = code;
  }
}
