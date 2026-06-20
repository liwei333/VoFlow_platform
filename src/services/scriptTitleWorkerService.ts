import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import {
  createLocalOpenAiCompatibleLlmProvider,
  type LocalLlmServiceConfig,
  type ScriptLlmProvider,
} from "@/services/scriptLlmProvider";
import {
  getScriptAiModelRegistry,
  requireAvailableLlmService,
  type ScriptAiModelRegistry,
} from "@/services/scriptModelRegistryService";

export const SCRIPT_TITLE_INVALID_NODE_INPUT = "SCRIPT_TITLE_INVALID_NODE_INPUT";
export const SCRIPT_TITLE_SOURCE_NOT_FOUND = "SCRIPT_TITLE_SOURCE_NOT_FOUND";
export const SCRIPT_TITLE_PROMPT_VERSION = 1;
export const SCRIPT_TITLE_PROMPT_TYPE = "script_title";

export interface TitleScriptRecord {
  id: string;
  content: string;
}

export interface SavedTitleCandidateRecord {
  id: string;
  titleCandidates: unknown;
  modelName: string | null;
  version: number;
  status: string;
}

export interface TitleCandidateRepository {
  findScript(scriptId: string): Promise<TitleScriptRecord | null>;
  saveTitleCandidates(input: SaveTitleCandidatesInput): Promise<SavedTitleCandidateRecord>;
}

export interface SaveTitleCandidatesInput {
  scriptId: string;
  scriptContent: string;
  titles: string[];
  modelName: string;
  prompt: unknown;
}

export interface ScriptAiRegistryReader {
  getRegistry(): Promise<ScriptAiModelRegistry>;
}

export interface ScriptLlmProviderFactory {
  createProvider(service: LocalLlmServiceConfig): ScriptLlmProvider;
}

export interface CreateTitleWorkflowNodeHandlerDependencies {
  registry: ScriptAiRegistryReader;
  providerFactory: ScriptLlmProviderFactory;
  repository: TitleCandidateRepository;
}

interface TitleWorkflowNodeInput {
  sourceType: "script_title";
  scriptId: string;
  platform?: string;
  titleCount?: number;
}

const prismaTitleCandidateRepository: TitleCandidateRepository = {
  findScript(scriptId) {
    return prisma.script.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        content: true,
      },
    });
  },

  async saveTitleCandidates(input) {
    const existingVersion = await prisma.scriptCandidate.aggregate({
      where: { scriptId: input.scriptId },
      _max: {
        version: true,
      },
    });
    const version = (existingVersion._max.version ?? 0) + 1;

    return prisma.scriptCandidate.create({
      data: {
        scriptId: input.scriptId,
        content: input.scriptContent,
        titleCandidates: toPrismaJson(input.titles),
        modelName: input.modelName,
        prompt: toPrismaJson(input.prompt),
        version,
        status: "draft",
      },
      select: {
        id: true,
        titleCandidates: true,
        modelName: true,
        version: true,
        status: true,
      },
    });
  },
};

const scriptAiRegistryReader: ScriptAiRegistryReader = {
  getRegistry: getScriptAiModelRegistry,
};

const localLlmProviderFactory: ScriptLlmProviderFactory = {
  createProvider: createLocalOpenAiCompatibleLlmProvider,
};

const defaultCreateTitleWorkflowNodeHandlerDependencies: CreateTitleWorkflowNodeHandlerDependencies = {
  registry: scriptAiRegistryReader,
  providerFactory: localLlmProviderFactory,
  repository: prismaTitleCandidateRepository,
};

export function createTitleWorkflowNodeHandler(
  dependencies: Partial<CreateTitleWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { registry, providerFactory, repository } = {
    ...defaultCreateTitleWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const parsedInput = parseTitleWorkflowNodeInput(input);
    const sourceScript = await repository.findScript(parsedInput.scriptId);
    if (!sourceScript) {
      throw new TitleWorkerError(SCRIPT_TITLE_SOURCE_NOT_FOUND, "原始文案不存在");
    }

    const modelRegistry = await registry.getRegistry();
    const llmService = requireAvailableLlmService(modelRegistry.llm);
    const provider = providerFactory.createProvider(llmService);
    const prompt = buildTitlePrompt(parsedInput);
    const titleResult = await provider.generateTitles(
      sourceScript.content,
      prompt.params.platform,
      {
        titleCount: prompt.params.titleCount,
        maxTokens: modelRegistry.generation.maxTokens,
        traceId: payload.traceId,
      }
    );
    const candidate = await repository.saveTitleCandidates({
      scriptId: sourceScript.id,
      scriptContent: sourceScript.content,
      titles: titleResult.titles,
      modelName: titleResult.modelName,
      prompt,
    });

    return {
      output: {
        sourceType: parsedInput.sourceType,
        scriptId: sourceScript.id,
        modelName: titleResult.modelName,
        titleCount: titleResult.titles.length,
        candidateId: candidate.id,
      },
    };
  };
}

function parseTitleWorkflowNodeInput(input: unknown): TitleWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TitleWorkerError(SCRIPT_TITLE_INVALID_NODE_INPUT, "标题生成节点输入无效");
  }

  const value = input as Partial<TitleWorkflowNodeInput>;
  if (value.sourceType !== "script_title" || typeof value.scriptId !== "string") {
    throw new TitleWorkerError(SCRIPT_TITLE_INVALID_NODE_INPUT, "标题生成节点输入无效");
  }

  return {
    sourceType: value.sourceType,
    scriptId: value.scriptId,
    platform: typeof value.platform === "string" ? value.platform : undefined,
    titleCount: typeof value.titleCount === "number" ? value.titleCount : undefined,
  };
}

function buildTitlePrompt(input: TitleWorkflowNodeInput) {
  return {
    promptType: SCRIPT_TITLE_PROMPT_TYPE,
    version: SCRIPT_TITLE_PROMPT_VERSION,
    params: {
      platform: input.platform?.trim() || "通用",
      titleCount: normalizeTitleCount(input.titleCount),
    },
  };
}

function normalizeTitleCount(titleCount = 5): number {
  if (!Number.isFinite(titleCount)) return 5;
  return Math.max(5, Math.round(titleCount));
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

class TitleWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TitleWorkerError";
    this.code = code;
  }
}
