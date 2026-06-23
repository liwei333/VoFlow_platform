import { Prisma } from "@prisma/client";
import { Readable } from "node:stream";
import { getObjectByPath } from "@/lib/storage";
import { prisma } from "@/lib/db";
import {
  VOICE_CLONE_MOCK_PROVIDER,
  VOICE_CLONE_OUTPUT_VOICE_NAME_SUFFIX,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
  type VoiceSampleErrorCode,
} from "@/lib/voice-clone/constants";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import {
  createVoiceTrainer,
  VoiceTrainerError,
  type LocalVoiceTrainerServiceConfig,
  type VoiceTrainer,
  type VoiceTrainerOutput,
} from "@/services/voiceTrainerService";

export interface VoiceCloneSampleStorage {
  downloadObject(storageUrl: string): Promise<Buffer>;
}

export type VoiceTrainerFactory = (
  provider: string,
  localService?: LocalVoiceTrainerServiceConfig | null
) => VoiceTrainer;

export type VoiceTrainerLocalServiceReader = () => Promise<LocalVoiceTrainerServiceConfig | null>;

export interface VoiceCloneWorkflowNodeHandlerDependencies {
  storage: VoiceCloneSampleStorage;
  trainerFactory: VoiceTrainerFactory;
  readLocalTrainerService: VoiceTrainerLocalServiceReader;
}

type VoiceCloneNodeInput = {
  voiceCloneJobId: string;
  voiceSampleId: string;
  provider: string;
};

type VoiceCloneJobWithSample = Prisma.VoiceCloneJobGetPayload<{
  include: { voiceSample: { include: { asset: true } } };
}>;

const objectStorage: VoiceCloneSampleStorage = {
  async downloadObject(storageUrl) {
    return readableToBuffer(await getObjectByPath(storageUrl));
  },
};

const defaultVoiceCloneWorkflowNodeHandlerDependencies: VoiceCloneWorkflowNodeHandlerDependencies = {
  storage: objectStorage,
  trainerFactory: createVoiceTrainer,
  readLocalTrainerService: readRegisteredLocalTrainerService,
};

export function createVoiceCloneWorkflowNodeHandler(
  dependencies: Partial<VoiceCloneWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { storage, trainerFactory, readLocalTrainerService } = {
    ...defaultVoiceCloneWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const nodeInput = parseVoiceCloneNodeInput(input);
    let activeVoiceCloneJobId: string | null = nodeInput.voiceCloneJobId;

    try {
      const voiceCloneJob = await prisma.voiceCloneJob.findFirst({
        where: {
          id: nodeInput.voiceCloneJobId,
          workflowNodeId: payload.nodeId,
          voiceSampleId: nodeInput.voiceSampleId,
        },
        include: {
          voiceSample: {
            include: {
              asset: true,
            },
          },
        },
      });

      if (!voiceCloneJob) {
        throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.jobNotFound);
      }
      activeVoiceCloneJobId = voiceCloneJob.id;

      await prisma.voiceCloneJob.update({
        where: { id: voiceCloneJob.id },
        data: {
          status: "running",
          errorJson: Prisma.JsonNull,
        },
      });

      const localService =
        voiceCloneJob.provider === VOICE_CLONE_MOCK_PROVIDER
          ? undefined
          : await readLocalTrainerService();
      const trainer = trainerFactory(voiceCloneJob.provider, localService);
      const sampleAudio = await storage.downloadObject(voiceCloneJob.voiceSample.asset.storageUrl);
      const trainerOutput = await trainer.train({
        voiceCloneJobId: voiceCloneJob.id,
        voiceSampleId: voiceCloneJob.voiceSampleId,
        sampleAssetId: voiceCloneJob.voiceSample.assetId,
        sampleFileName: getFileName(voiceCloneJob.voiceSample.asset.storageUrl),
        sampleAudio,
        traceId: payload.traceId,
      });

      const outputVoice = await persistClonedVoiceFromTrainerOutput(voiceCloneJob, trainerOutput);

      return {
        status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
        requiresApproval: WORKFLOW_NODE_DEFINITIONS.voice_clone.requiresApproval,
        output: {
          voiceCloneJobId: voiceCloneJob.id,
          voiceSampleId: voiceCloneJob.voiceSampleId,
          voiceId: outputVoice.id,
          provider: trainerOutput.provider,
          modelId: trainerOutput.modelId,
          sampleUrl: trainerOutput.sampleUrl,
          logs: trainerOutput.logs,
          ...(trainerOutput.providerRequestId
            ? { providerRequestId: trainerOutput.providerRequestId }
            : {}),
        },
      };
    } catch (error) {
      const normalized = normalizeVoiceTrainerError(error);
      if (activeVoiceCloneJobId) {
        await prisma.voiceCloneJob.update({
          where: { id: activeVoiceCloneJobId },
          data: {
            status: "failed",
            errorJson: toPrismaJson(normalized),
          },
        });
      }

      throw new VoiceTrainerError(normalized.code, normalized.message);
    }
  };
}

async function persistClonedVoiceFromTrainerOutput(
  voiceCloneJob: VoiceCloneJobWithSample,
  trainerOutput: VoiceTrainerOutput
) {
  return prisma.$transaction(async (tx) => {
    const voiceData = {
      teamId: voiceCloneJob.voiceSample.teamId,
      ownerId: voiceCloneJob.voiceSample.ownerId,
      voiceType: "cloned" as const,
      name: buildClonedVoiceName(voiceCloneJob.voiceSample.asset.name),
      provider: trainerOutput.provider,
      modelId: trainerOutput.modelId,
      status: "active" as const,
      licenseStatus: "approved" as const,
      sampleUrl: trainerOutput.sampleUrl,
      metadata: toPrismaJson({
        voiceCloneJobId: voiceCloneJob.id,
        voiceSampleId: voiceCloneJob.voiceSampleId,
        sampleAssetId: voiceCloneJob.voiceSample.assetId,
        ...(trainerOutput.providerRequestId
          ? { providerRequestId: trainerOutput.providerRequestId }
          : {}),
        trainerLogs: trainerOutput.logs,
      }),
    };

    const outputVoice = voiceCloneJob.outputVoiceId
      ? await tx.voice.update({
          where: { id: voiceCloneJob.outputVoiceId },
          data: voiceData,
          select: { id: true },
        })
      : await tx.voice.create({
          data: voiceData,
          select: { id: true },
        });

    await tx.voiceCloneJob.update({
      where: { id: voiceCloneJob.id },
      data: {
        status: "succeeded",
        outputVoiceId: outputVoice.id,
        errorJson: Prisma.JsonNull,
      },
    });

    return outputVoice;
  });
}

async function readRegisteredLocalTrainerService(): Promise<LocalVoiceTrainerServiceConfig | null> {
  return prisma.localModelService.findUnique({
    where: {
      serviceType: "tts",
    },
    select: {
      baseUrl: true,
      status: true,
      modelName: true,
    },
  });
}

function parseVoiceCloneNodeInput(input: unknown): VoiceCloneNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.jobNotFound);
  }

  const value = input as {
    voiceCloneJobId?: unknown;
    voiceSampleId?: unknown;
    provider?: unknown;
  };

  if (typeof value.voiceCloneJobId !== "string" || !value.voiceCloneJobId) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.jobNotFound);
  }
  if (typeof value.voiceSampleId !== "string" || !value.voiceSampleId) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.notFound);
  }

  return {
    voiceCloneJobId: value.voiceCloneJobId,
    voiceSampleId: value.voiceSampleId,
    provider: typeof value.provider === "string" ? value.provider : VOICE_CLONE_MOCK_PROVIDER,
  };
}

function normalizeVoiceTrainerError(error: unknown) {
  if (error instanceof VoiceTrainerError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  return {
    code: VOICE_SAMPLE_ERROR_CODES.trainingFailed,
    message: error instanceof Error ? error.message : VOICE_SAMPLE_ERROR_MESSAGES[VOICE_SAMPLE_ERROR_CODES.trainingFailed],
  };
}

function voiceTrainerError(code: VoiceSampleErrorCode) {
  return new VoiceTrainerError(code, VOICE_SAMPLE_ERROR_MESSAGES[code]);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function getFileName(storageUrl: string): string {
  return storageUrl.substring(storageUrl.lastIndexOf("/") + 1);
}

function buildClonedVoiceName(sampleName: string): string {
  return `${sampleName} ${VOICE_CLONE_OUTPUT_VOICE_NAME_SUFFIX}`;
}

async function readableToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
