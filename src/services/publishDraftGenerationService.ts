import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PUBLISH_PLATFORMS,
  getPublishPlatformRule,
  type PublishPlatform,
  type PublishPlatformRule,
} from "@/lib/publish/rules";
import {
  serializePublishDraft,
  type PublishDraftRecord,
  type SerializedPublishDraft,
} from "@/lib/publish/serializer";
import {
  createLocalPublishDraftLlmProvider,
  type GeneratePublishDraftResult,
  type PublishDraftLlmProvider,
} from "@/services/publishDraftLlmProvider";
import {
  getScriptAiModelRegistry,
  requireAvailableLlmService,
  type ScriptAiModelRegistry,
} from "@/services/scriptModelRegistryService";
import type { LocalLlmServiceConfig } from "@/services/scriptLlmProvider";

export type GeneratePublishDraftsErrorCode =
  | "PUBLISH_JOB_NOT_FOUND"
  | "PUBLISH_SCRIPT_NOT_READY"
  | "PUBLISH_PLATFORM_UNSUPPORTED";

export interface GeneratePublishDraftsInput {
  jobId: string;
  teamId: string;
  platforms?: string[];
  traceId?: string;
}

export type GeneratePublishDraftsResult =
  | {
      success: true;
      data: {
        drafts: SerializedPublishDraft[];
      };
    }
  | {
      success: false;
      error: {
        code: GeneratePublishDraftsErrorCode;
        message: string;
      };
    };

export interface PublishDraftGenerationRegistry {
  getRegistry(): Promise<ScriptAiModelRegistry>;
}

export interface PublishDraftProviderFactory {
  createProvider(service: LocalLlmServiceConfig): PublishDraftLlmProvider;
}

export interface PublishDraftGenerationDependencies {
  registry: PublishDraftGenerationRegistry;
  providerFactory: PublishDraftProviderFactory;
}

interface ApprovedScriptRecord {
  id: string;
  content: string;
}

interface JobWithApprovedScriptRecord {
  id: string;
  scripts: ApprovedScriptRecord[];
}

const defaultPublishDraftGenerationDependencies: PublishDraftGenerationDependencies = {
  registry: {
    getRegistry: getScriptAiModelRegistry,
  },
  providerFactory: {
    createProvider(service) {
      return createLocalPublishDraftLlmProvider({ service });
    },
  },
};

export async function generatePublishDrafts(
  input: GeneratePublishDraftsInput,
  dependencies: Partial<PublishDraftGenerationDependencies> = {}
): Promise<GeneratePublishDraftsResult> {
  const { registry, providerFactory } = {
    ...defaultPublishDraftGenerationDependencies,
    ...dependencies,
  };
  const platforms = normalizePlatforms(input.platforms);
  if (!platforms.success) {
    return platforms;
  }

  const job = await findJobWithApprovedScript(input);
  if (!job) {
    return {
      success: false,
      error: {
        code: "PUBLISH_JOB_NOT_FOUND",
        message: "视频任务不存在",
      },
    };
  }

  const script = job.scripts[0];
  if (!script?.content.trim()) {
    return {
      success: false,
      error: {
        code: "PUBLISH_SCRIPT_NOT_READY",
        message: "最终文案不存在",
      },
    };
  }

  const modelRegistry = await registry.getRegistry();
  const llmService = requireAvailableLlmService(modelRegistry.llm);
  const provider = providerFactory.createProvider(llmService);
  const drafts: SerializedPublishDraft[] = [];

  for (const platform of platforms.data) {
    const rule = getPublishPlatformRule(platform);
    const generated = await provider.generateDraft(
      {
        script: script.content,
        platform,
        platformLabel: rule.label,
        rule,
      },
      {
        maxTokens: modelRegistry.generation.maxTokens,
        traceId: input.traceId,
      }
    );
    const normalized = normalizeGeneratedDraft(generated, rule);
    const saved = await upsertPublishDraft({
      jobId: job.id,
      platform,
      title: normalized.title,
      description: normalized.description,
      tags: normalized.tags,
      topics: normalized.topics,
    });

    drafts.push(serializePublishDraft(saved));
  }

  return {
    success: true,
    data: {
      drafts,
    },
  };
}

function normalizePlatforms(platforms?: string[]):
  | { success: true; data: PublishPlatform[] }
  | { success: false; error: { code: "PUBLISH_PLATFORM_UNSUPPORTED"; message: string } } {
  const requested = platforms && platforms.length > 0 ? platforms : [...PUBLISH_PLATFORMS];
  const normalized: PublishPlatform[] = [];

  for (const platform of requested) {
    try {
      const rule = getPublishPlatformRule(platform);
      if (!normalized.includes(rule.platform)) {
        normalized.push(rule.platform);
      }
    } catch {
      return {
        success: false,
        error: {
          code: "PUBLISH_PLATFORM_UNSUPPORTED",
          message: "不支持该发布平台",
        },
      };
    }
  }

  return { success: true, data: normalized };
}

function findJobWithApprovedScript(input: GeneratePublishDraftsInput): Promise<JobWithApprovedScriptRecord | null> {
  return prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
    },
    select: {
      id: true,
      scripts: {
        where: {
          status: "approved",
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        select: {
          id: true,
          content: true,
        },
      },
    },
  });
}

async function upsertPublishDraft(input: {
  jobId: string;
  platform: PublishPlatform;
  title: string;
  description: string;
  tags: string[];
  topics: string[];
}): Promise<PublishDraftRecord> {
  return prisma.publishDraft.upsert({
    where: {
      jobId_platform: {
        jobId: input.jobId,
        platform: input.platform,
      },
    },
    create: {
      jobId: input.jobId,
      platform: input.platform,
      title: input.title,
      description: input.description,
      tagsJson: toPrismaJson(input.tags),
      topicsJson: toPrismaJson(input.topics),
    },
    update: {
      title: input.title,
      description: input.description,
      tagsJson: toPrismaJson(input.tags),
      topicsJson: toPrismaJson(input.topics),
      validationJson: Prisma.DbNull,
    },
    select: {
      id: true,
      jobId: true,
      platform: true,
      title: true,
      description: true,
      tagsJson: true,
      topicsJson: true,
      coverArtifactId: true,
      validationJson: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<PublishDraftRecord>;
}

function normalizeGeneratedDraft(
  draft: GeneratePublishDraftResult,
  rule: PublishPlatformRule
): Pick<GeneratePublishDraftResult, "title" | "description" | "tags" | "topics"> {
  const title = truncateText(draft.title, rule.title.maxChars);
  const description = draft.description.trim() || title;

  return {
    title,
    description,
    tags: uniqueStrings(draft.tags).slice(0, rule.tags.maxCount),
    topics: uniqueStrings(draft.topics),
  };
}

function truncateText(value: string, maxChars: number): string {
  const normalized = value.trim();
  return Array.from(normalized).slice(0, maxChars).join("");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
