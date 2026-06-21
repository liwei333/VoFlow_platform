import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uploadJobArtifact } from "@/lib/storage";
import {
  TTS_AUDIO_ARTIFACT_TYPE,
  TTS_ERROR_CODES,
  TTS_NODE_TYPE,
} from "@/lib/tts/constants";
import { ttsParamsSchema } from "@/lib/tts/validation";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import { writeWorkflowArtifact } from "@/services/workflowArtifactService";
import {
  createTtsProvider,
  inspectTtsAudio,
  TtsProviderError,
  type TtsProvider,
} from "@/services/ttsProviderService";

export type TtsProviderFactory = (provider: string) => TtsProvider;

export interface TtsWorkflowNodeHandlerDependencies {
  providerFactory: TtsProviderFactory;
  uploadArtifact: typeof uploadJobArtifact;
  writeArtifact: typeof writeWorkflowArtifact;
}

const defaultTtsWorkflowNodeHandlerDependencies: TtsWorkflowNodeHandlerDependencies = {
  providerFactory: createTtsProvider,
  uploadArtifact: uploadJobArtifact,
  writeArtifact: writeWorkflowArtifact,
};

export function createTtsWorkflowNodeHandler(
  dependencies: Partial<TtsWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { providerFactory, uploadArtifact, writeArtifact } = {
    ...defaultTtsWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const nodeInput = parseTtsNodeInput(input);

    const ttsRequest = await prisma.ttsRequest.findFirst({
      where: {
        id: nodeInput.ttsRequestId,
        nodeId: payload.nodeId,
      },
      include: {
        job: {
          select: {
            id: true,
            teamId: true,
          },
        },
        voice: {
          select: {
            id: true,
            name: true,
            provider: true,
            modelId: true,
          },
        },
        scriptCandidate: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    if (!ttsRequest) {
      throw new TtsProviderError(TTS_ERROR_CODES.TTS_REQUEST_NOT_FOUND);
    }

    await prisma.ttsRequest.update({
      where: { id: ttsRequest.id },
      data: { status: "processing", errorJson: Prisma.JsonNull },
    });

    const provider = providerFactory(ttsRequest.provider);
    const providerOutput = inspectTtsAudio(
      await provider.synthesize({
        text: ttsRequest.scriptCandidate.content,
        voice: ttsRequest.voice,
        params: {
          speed: ttsRequest.speed,
          pitch: ttsRequest.pitch,
          pauseJson: parsePauseJson(ttsRequest.pauseJson),
        },
      })
    );

    const fileName = `${ttsRequest.id}.${providerOutput.fileExtension}`;
    const storageUrl = await uploadArtifact(
      ttsRequest.job.teamId,
      ttsRequest.job.id,
      TTS_NODE_TYPE,
      fileName,
      providerOutput.audioBuffer,
      providerOutput.contentType,
      providerOutput.audioBuffer.length
    );
    const artifact = await writeArtifact({
      jobId: payload.jobId,
      nodeId: payload.nodeId,
      type: TTS_AUDIO_ARTIFACT_TYPE,
      storageUrl,
      metadata: providerOutput.metadata,
    });

    await prisma.ttsRequest.update({
      where: { id: ttsRequest.id },
      data: {
        status: "waiting_approval",
        providerRequestId: providerOutput.providerRequestId,
        audioArtifactId: artifact.id,
        errorJson: Prisma.JsonNull,
      },
    });

    return {
      status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
      requiresApproval: true,
      output: {
        ttsRequestId: ttsRequest.id,
        audioArtifactId: artifact.id,
        storageUrl,
        metadata: providerOutput.metadata,
      },
    };
  };
}

function parseTtsNodeInput(input: unknown): { ttsRequestId: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TtsProviderError(TTS_ERROR_CODES.TTS_REQUEST_NOT_FOUND);
  }

  const ttsRequestId = (input as { ttsRequestId?: unknown }).ttsRequestId;
  if (typeof ttsRequestId !== "string" || !ttsRequestId) {
    throw new TtsProviderError(TTS_ERROR_CODES.TTS_REQUEST_NOT_FOUND);
  }

  return { ttsRequestId };
}

function parsePauseJson(value: unknown) {
  const result = ttsParamsSchema.shape.pauseJson.safeParse(value);
  return result.success ? result.data : undefined;
}
