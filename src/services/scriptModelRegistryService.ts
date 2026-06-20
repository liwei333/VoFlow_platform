import { LocalModelServiceStatus, LocalModelServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  LOCAL_OPENAI_COMPATIBLE_PROVIDER,
  type LocalLlmServiceConfig,
} from "@/services/scriptLlmProvider";

export const LOCAL_LLM_UNAVAILABLE = "LOCAL_LLM_UNAVAILABLE";
export const LOCAL_ASR_UNAVAILABLE = "LOCAL_ASR_UNAVAILABLE";

export type ScriptAiEnv = Record<string, string | undefined>;

export interface ScriptAiLlmService {
  serviceType: "llm";
  baseUrl: string | null;
  modelName: string | null;
  status: LocalModelServiceStatus;
}

export interface ScriptAiAsrService {
  serviceType: "asr";
  baseUrl: string | null;
  status: LocalModelServiceStatus;
}

export interface ScriptAiGenerationConfig {
  provider: string;
  maxTokens?: number;
}

export interface ScriptAiModelRegistry {
  llm: ScriptAiLlmService | null;
  asr: ScriptAiAsrService | null;
  generation: ScriptAiGenerationConfig;
}

export interface ScriptAiModelServiceRecord {
  serviceType: "llm" | "asr";
  baseUrl: string | null;
  modelName: string | null;
  status: LocalModelServiceStatus;
}

export interface ScriptAiModelRegistryRepository {
  findScriptModelServices(): Promise<ScriptAiModelServiceRecord[]>;
}

export interface GetScriptAiModelRegistryInput {
  env?: ScriptAiEnv;
  repository?: ScriptAiModelRegistryRepository;
}

const prismaScriptAiModelRegistryRepository: ScriptAiModelRegistryRepository = {
  findScriptModelServices() {
    return prisma.localModelService.findMany({
      where: {
        serviceType: {
          in: ["llm", "asr"] satisfies LocalModelServiceType[],
        },
      },
      select: {
        serviceType: true,
        baseUrl: true,
        modelName: true,
        status: true,
      },
    }) as Promise<ScriptAiModelServiceRecord[]>;
  },
};

export async function getScriptAiModelRegistry(
  input: GetScriptAiModelRegistryInput = {}
): Promise<ScriptAiModelRegistry> {
  const env = input.env ?? process.env;
  const repository = input.repository ?? prismaScriptAiModelRegistryRepository;
  const services = await repository.findScriptModelServices();
  const llm = services.find((service) => service.serviceType === "llm") ?? null;
  const asr = services.find((service) => service.serviceType === "asr") ?? null;

  return {
    llm: llm
      ? {
          serviceType: "llm",
          baseUrl: llm.baseUrl,
          modelName: llm.modelName,
          status: llm.status,
        }
      : null,
    asr: asr
      ? {
          serviceType: "asr",
          baseUrl: asr.baseUrl,
          status: asr.status,
        }
      : null,
    generation: readGenerationConfig(env),
  };
}

export function requireAvailableLlmService(service: ScriptAiLlmService | null): LocalLlmServiceConfig {
  if (!service?.baseUrl || !service.modelName || service.status !== "online") {
    throw new ScriptModelRegistryError(LOCAL_LLM_UNAVAILABLE, "本地 LLM 服务不可用");
  }

  return {
    baseUrl: service.baseUrl,
    modelName: service.modelName,
  };
}

export function requireAvailableAsrService(service: ScriptAiAsrService | null): { baseUrl: string } {
  if (!service?.baseUrl || service.status !== "online") {
    throw new ScriptModelRegistryError(LOCAL_ASR_UNAVAILABLE, "ASR 服务不可用");
  }

  return {
    baseUrl: service.baseUrl,
  };
}

function readGenerationConfig(env: ScriptAiEnv): ScriptAiGenerationConfig {
  const config: ScriptAiGenerationConfig = {
    provider: readEnvString(env, "LLM_PROVIDER") ?? LOCAL_OPENAI_COMPATIBLE_PROVIDER,
  };
  const maxTokens = readPositiveInteger(env, "LLM_MAX_TOKENS");

  if (maxTokens !== undefined) {
    config.maxTokens = maxTokens;
  }

  return config;
}

function readEnvString(env: ScriptAiEnv, key: string): string | undefined {
  const value = env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readPositiveInteger(env: ScriptAiEnv, key: string): number | undefined {
  const value = readEnvString(env, key);
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;

  return parsed;
}

export class ScriptModelRegistryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ScriptModelRegistryError";
    this.code = code;
  }
}
