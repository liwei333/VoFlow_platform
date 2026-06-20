import { LocalModelServiceStatus, LocalModelServiceType } from "@prisma/client";
import { Readable } from "node:stream";
import { getObjectByPath } from "@/lib/storage";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import { prisma } from "@/lib/db";
import {
  saveAsrTranscriptionResult,
  type SaveAsrTranscriptionResultInput,
} from "@/services/scriptService";
import {
  LOCAL_ASR_UNAVAILABLE as SCRIPT_MODEL_LOCAL_ASR_UNAVAILABLE,
  requireAvailableAsrService,
} from "@/services/scriptModelRegistryService";

export const LOCAL_ASR_UNAVAILABLE = SCRIPT_MODEL_LOCAL_ASR_UNAVAILABLE;
export const ASR_INVALID_NODE_INPUT = "ASR_INVALID_NODE_INPUT";

export interface AsrServiceRegistryRecord {
  serviceType: LocalModelServiceType;
  name: string;
  baseUrl: string | null;
  status: LocalModelServiceStatus;
}

export interface AsrSegmentOutput {
  startMs: number;
  endMs: number;
  text: string;
}

export interface AsrProviderInput {
  service: {
    baseUrl: string;
  };
  media: Buffer;
  assetId: string;
  assetType: "audio" | "video";
  durationMs: number;
  traceId: string;
}

export interface AsrProviderOutput {
  text: string;
  segments: AsrSegmentOutput[];
  provider: string;
}

export interface AsrProvider {
  transcribe(input: AsrProviderInput): Promise<AsrProviderOutput>;
}

export interface AsrMediaStorage {
  downloadObject(storageUrl: string): Promise<Buffer>;
}

export interface AsrServiceRegistry {
  getAsrService(): Promise<AsrServiceRegistryRecord | null>;
}

export interface AsrTranscriptionResultWriter {
  saveTranscription(input: SaveAsrTranscriptionResultInput): Promise<{ id: string }>;
}

export interface CreateAsrWorkflowNodeHandlerDependencies {
  storage: AsrMediaStorage;
  registry: AsrServiceRegistry;
  provider: AsrProvider;
  resultWriter: AsrTranscriptionResultWriter;
}

interface AsrWorkflowNodeInput {
  sourceType: "media_asr";
  assetId: string;
  assetType: "audio" | "video";
  storageUrl: string;
  durationMs: number;
}

const prismaAsrServiceRegistry: AsrServiceRegistry = {
  getAsrService() {
    return prisma.localModelService.findUnique({
      where: { serviceType: "asr" },
      select: {
        serviceType: true,
        name: true,
        baseUrl: true,
        status: true,
      },
    });
  },
};

const objectStorage: AsrMediaStorage = {
  async downloadObject(storageUrl) {
    return readableToBuffer(await getObjectByPath(storageUrl));
  },
};

const mockAsrProvider: AsrProvider = {
  async transcribe() {
    return {
      text: "",
      segments: [],
      provider: "mock-asr",
    };
  },
};

const prismaAsrTranscriptionResultWriter: AsrTranscriptionResultWriter = {
  saveTranscription: saveAsrTranscriptionResult,
};

const defaultCreateAsrWorkflowNodeHandlerDependencies: CreateAsrWorkflowNodeHandlerDependencies = {
  storage: objectStorage,
  registry: prismaAsrServiceRegistry,
  provider: mockAsrProvider,
  resultWriter: prismaAsrTranscriptionResultWriter,
};

export function createAsrWorkflowNodeHandler(
  dependencies: Partial<CreateAsrWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { storage, registry, provider, resultWriter } = {
    ...defaultCreateAsrWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const parsedInput = parseAsrWorkflowNodeInput(input);
    const service = await registry.getAsrService();

    const availableService = requireAvailableAsrService(service);

    const media = await storage.downloadObject(parsedInput.storageUrl);
    const result = await provider.transcribe({
      service: {
        baseUrl: availableService.baseUrl,
      },
      media,
      assetId: parsedInput.assetId,
      assetType: parsedInput.assetType,
      durationMs: parsedInput.durationMs,
      traceId: payload.traceId,
    });
    const script = await resultWriter.saveTranscription({
      jobId: payload.jobId,
      assetId: parsedInput.assetId,
      assetType: parsedInput.assetType,
      durationMs: parsedInput.durationMs,
      text: result.text,
      segments: result.segments,
      provider: result.provider,
    });

    return {
      output: {
        sourceType: parsedInput.sourceType,
        assetId: parsedInput.assetId,
        assetType: parsedInput.assetType,
        durationMs: parsedInput.durationMs,
        text: result.text,
        segments: result.segments,
        provider: result.provider,
        scriptId: script.id,
      },
    };
  };
}

class AsrWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AsrWorkerError";
    this.code = code;
  }
}

function parseAsrWorkflowNodeInput(input: unknown): AsrWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AsrWorkerError(ASR_INVALID_NODE_INPUT, "ASR 节点输入无效");
  }

  const value = input as Partial<AsrWorkflowNodeInput>;
  if (
    value.sourceType !== "media_asr" ||
    typeof value.assetId !== "string" ||
    (value.assetType !== "audio" && value.assetType !== "video") ||
    typeof value.storageUrl !== "string" ||
    typeof value.durationMs !== "number"
  ) {
    throw new AsrWorkerError(ASR_INVALID_NODE_INPUT, "ASR 节点输入无效");
  }

  return {
    sourceType: value.sourceType,
    assetId: value.assetId,
    assetType: value.assetType,
    storageUrl: value.storageUrl,
    durationMs: value.durationMs,
  };
}

async function readableToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
