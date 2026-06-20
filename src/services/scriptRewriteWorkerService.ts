import { Prisma } from "@prisma/client";
import { buildRewriteScriptPrompt } from "@/lib/scripts/promptTemplates";
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

export const SCRIPT_REWRITE_INVALID_NODE_INPUT = "SCRIPT_REWRITE_INVALID_NODE_INPUT";
export const SCRIPT_REWRITE_SOURCE_NOT_FOUND = "SCRIPT_REWRITE_SOURCE_NOT_FOUND";

export interface RewriteScriptRecord {
  id: string;
  content: string;
}

export interface SavedRewriteCandidateRecord {
  id: string;
  content: string;
  modelName: string | null;
  version: number;
  status: string;
}

export interface RewriteCandidateRepository {
  findScript(scriptId: string): Promise<RewriteScriptRecord | null>;
  saveCandidates(input: SaveRewriteCandidatesInput): Promise<SavedRewriteCandidateRecord[]>;
}

export interface SaveRewriteCandidatesInput {
  scriptId: string;
  contents: string[];
  modelName: string;
  prompt: unknown;
}

export interface ScriptAiRegistryReader {
  getRegistry(): Promise<ScriptAiModelRegistry>;
}

export interface ScriptLlmProviderFactory {
  createProvider(service: LocalLlmServiceConfig): ScriptLlmProvider;
}

export interface CreateRewriteWorkflowNodeHandlerDependencies {
  registry: ScriptAiRegistryReader;
  providerFactory: ScriptLlmProviderFactory;
  repository: RewriteCandidateRepository;
}

interface RewriteWorkflowNodeInput {
  sourceType: "script_rewrite";
  scriptId: string;
  platform?: string;
  durationSeconds?: number;
  tone?: string;
  forbiddenWords?: string[];
  candidateCount?: number;
}

const prismaRewriteCandidateRepository: RewriteCandidateRepository = {
  findScript(scriptId) {
    return prisma.script.findUnique({
      where: { id: scriptId },
      select: {
        id: true,
        content: true,
      },
    });
  },

  async saveCandidates(input) {
    return prisma.$transaction(async (tx) => {
      const existingVersion = await tx.scriptCandidate.aggregate({
        where: { scriptId: input.scriptId },
        _max: {
          version: true,
        },
      });
      const version = (existingVersion._max.version ?? 0) + 1;
      const saved: SavedRewriteCandidateRecord[] = [];

      for (const content of input.contents) {
        const candidate = await tx.scriptCandidate.create({
          data: {
            scriptId: input.scriptId,
            content,
            modelName: input.modelName,
            prompt: toPrismaJson(input.prompt),
            version,
            status: "draft",
          },
          select: {
            id: true,
            content: true,
            modelName: true,
            version: true,
            status: true,
          },
        });
        saved.push(candidate);
      }

      return saved;
    });
  },
};

const scriptAiRegistryReader: ScriptAiRegistryReader = {
  getRegistry: getScriptAiModelRegistry,
};

const localLlmProviderFactory: ScriptLlmProviderFactory = {
  createProvider(service) {
    return createLocalOpenAiCompatibleLlmProvider({ service });
  },
};

const defaultCreateRewriteWorkflowNodeHandlerDependencies: CreateRewriteWorkflowNodeHandlerDependencies = {
  registry: scriptAiRegistryReader,
  providerFactory: localLlmProviderFactory,
  repository: prismaRewriteCandidateRepository,
};

export function createRewriteWorkflowNodeHandler(
  dependencies: Partial<CreateRewriteWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { registry, providerFactory, repository } = {
    ...defaultCreateRewriteWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const parsedInput = parseRewriteWorkflowNodeInput(input);
    const sourceScript = await repository.findScript(parsedInput.scriptId);
    if (!sourceScript) {
      throw new RewriteWorkerError(SCRIPT_REWRITE_SOURCE_NOT_FOUND, "原始文案不存在");
    }

    const modelRegistry = await registry.getRegistry();
    const llmService = requireAvailableLlmService(modelRegistry.llm);
    const prompt = buildRewriteScriptPrompt({
      script: sourceScript.content,
      platform: parsedInput.platform,
      durationSeconds: parsedInput.durationSeconds,
      tone: parsedInput.tone,
      forbiddenWords: parsedInput.forbiddenWords,
      candidateCount: parsedInput.candidateCount,
    });
    const provider = providerFactory.createProvider(llmService);
    const rewriteResult = await provider.rewriteScript(
      {
        script: sourceScript.content,
        platform: prompt.params.platform,
        durationSeconds: prompt.params.durationSeconds ?? undefined,
        tone: prompt.params.tone,
        forbiddenWords: prompt.params.forbiddenWords,
      },
      {
        candidateCount: prompt.params.candidateCount,
        maxTokens: modelRegistry.generation.maxTokens,
        traceId: payload.traceId,
      }
    );
    const candidates = await repository.saveCandidates({
      scriptId: sourceScript.id,
      contents: rewriteResult.candidates,
      modelName: rewriteResult.modelName,
      prompt,
    });

    return {
      output: {
        sourceType: parsedInput.sourceType,
        scriptId: sourceScript.id,
        modelName: rewriteResult.modelName,
        candidateCount: candidates.length,
        candidateIds: candidates.map((candidate) => candidate.id),
      },
    };
  };
}

function parseRewriteWorkflowNodeInput(input: unknown): RewriteWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RewriteWorkerError(SCRIPT_REWRITE_INVALID_NODE_INPUT, "文案改写节点输入无效");
  }

  const value = input as Partial<RewriteWorkflowNodeInput>;
  if (value.sourceType !== "script_rewrite" || typeof value.scriptId !== "string") {
    throw new RewriteWorkerError(SCRIPT_REWRITE_INVALID_NODE_INPUT, "文案改写节点输入无效");
  }

  return {
    sourceType: value.sourceType,
    scriptId: value.scriptId,
    platform: typeof value.platform === "string" ? value.platform : undefined,
    durationSeconds: typeof value.durationSeconds === "number" ? value.durationSeconds : undefined,
    tone: typeof value.tone === "string" ? value.tone : undefined,
    forbiddenWords: Array.isArray(value.forbiddenWords)
      ? value.forbiddenWords.filter((word): word is string => typeof word === "string")
      : undefined,
    candidateCount: typeof value.candidateCount === "number" ? value.candidateCount : undefined,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

class RewriteWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RewriteWorkerError";
    this.code = code;
  }
}
