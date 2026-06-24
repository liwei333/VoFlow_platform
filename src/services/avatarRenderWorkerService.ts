import { Readable } from "node:stream";
import {
  AVATAR_RENDER_CROPS,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  AVATAR_RENDER_MOCK_PROVIDER,
  AVATAR_RENDER_NODE_TYPE,
  AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
  AVATAR_RENDER_VIDEO_CONTENT_TYPE,
  AVATAR_RENDER_VIDEO_EXTENSION,
  type AvatarRenderCrop,
  type AvatarRenderErrorCode,
  type AvatarRenderMode,
} from "@/lib/avatar-render/constants";
import type { AvatarRenderOptions } from "@/lib/avatar-render/types";
import {
  AvatarRenderOutputValidationError,
  validateAvatarRenderOutput,
  type AvatarRenderOutputValidationInput,
  type AvatarRenderOutputValidationResult,
} from "@/lib/avatar-render/output-validation";
import { VALID_ASPECT_RATIOS, type ApiAspectRatio } from "@/lib/aspect-ratio";
import { prisma } from "@/lib/db";
import { getObjectByPath, uploadJobArtifact } from "@/lib/storage";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import {
  AvatarRenderProviderError,
  createAvatarRenderProvider,
  type AvatarRenderProvider,
} from "@/services/avatarRenderProviderService";
import type { LocalAvatarRenderServiceConfig } from "@/lib/avatar-render/types";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import { writeWorkflowArtifact } from "@/services/workflowArtifactService";

export interface AvatarRenderInputStorage {
  downloadObject(storageUrl: string): Promise<Buffer>;
}

export type AvatarRenderProviderFactory = (
  provider: string,
  localService?: LocalAvatarRenderServiceConfig | null
) => AvatarRenderProvider;

export type AvatarRenderLocalServiceReader = () => Promise<LocalAvatarRenderServiceConfig | null>;
export type AvatarRenderOutputValidator = (
  input: AvatarRenderOutputValidationInput
) => Promise<AvatarRenderOutputValidationResult>;

export interface AvatarRenderWorkflowNodeHandlerDependencies {
  storage: AvatarRenderInputStorage;
  providerFactory: AvatarRenderProviderFactory;
  readLocalAvatarService: AvatarRenderLocalServiceReader;
  validateOutput: AvatarRenderOutputValidator;
  uploadArtifact: typeof uploadJobArtifact;
  writeArtifact: typeof writeWorkflowArtifact;
}

type AvatarRenderNodeInput = {
  avatarRenderRequestId: string;
  avatarId: string;
  audioArtifactId: string;
  mode: AvatarRenderMode;
  aspectRatio: ApiAspectRatio;
  sourceImageUrl: string;
  audioUrl: string;
  renderOptions: AvatarRenderOptions;
};

const objectStorage: AvatarRenderInputStorage = {
  async downloadObject(storageUrl) {
    return readableToBuffer(await getObjectByPath(storageUrl));
  },
};

const defaultAvatarRenderWorkflowNodeHandlerDependencies: AvatarRenderWorkflowNodeHandlerDependencies = {
  storage: objectStorage,
  providerFactory: createAvatarRenderProvider,
  readLocalAvatarService: readRegisteredLocalAvatarService,
  validateOutput: validateAvatarRenderOutput,
  uploadArtifact: uploadJobArtifact,
  writeArtifact: writeWorkflowArtifact,
};

export function createAvatarRenderWorkflowNodeHandler(
  dependencies: Partial<AvatarRenderWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const {
    storage,
    providerFactory,
    readLocalAvatarService,
    validateOutput,
    uploadArtifact,
    writeArtifact,
  } = {
    ...defaultAvatarRenderWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const nodeInput = parseAvatarRenderNodeInput(input);
    const avatarRenderRequest = await prisma.avatarRenderRequest.findFirst({
      where: {
        id: nodeInput.avatarRenderRequestId,
        jobId: payload.jobId,
        nodeId: payload.nodeId,
        avatarId: nodeInput.avatarId,
        audioArtifactId: nodeInput.audioArtifactId,
      },
      include: {
        job: {
          select: {
            id: true,
            teamId: true,
          },
        },
      },
    });

    if (!avatarRenderRequest) {
      throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.renderRequestNotFound);
    }

    try {
      const sourceImage = await storage.downloadObject(nodeInput.sourceImageUrl);
      const audio = await storage.downloadObject(nodeInput.audioUrl);
      const localAvatarService =
        avatarRenderRequest.provider === AVATAR_RENDER_MOCK_PROVIDER
          ? undefined
          : await readLocalAvatarService();
      const provider = providerFactory(avatarRenderRequest.provider, localAvatarService);
      const providerOutput = await provider.renderAvatarVideo({
        requestId: avatarRenderRequest.id,
        jobId: payload.jobId,
        nodeId: payload.nodeId,
        avatarId: avatarRenderRequest.avatarId,
        sourceImageUrl: nodeInput.sourceImageUrl,
        audioUrl: nodeInput.audioUrl,
        sourceImage,
        audio,
        mode: avatarRenderRequest.mode,
        aspectRatio: nodeInput.aspectRatio,
        renderOptions: nodeInput.renderOptions,
        traceId: payload.traceId,
      });
      const outputValidation = await validateOutput({
        videoPath: providerOutput.videoPath,
        expectedDurationMs: providerOutput.durationMs,
        contentType: providerOutput.metadata.contentType,
        fileExtension: providerOutput.metadata.fileExtension,
      });
      const fileName = `${avatarRenderRequest.id}.${
        outputValidation.metadata.fileExtension || AVATAR_RENDER_VIDEO_EXTENSION
      }`;
      const contentType =
        outputValidation.metadata.contentType || AVATAR_RENDER_VIDEO_CONTENT_TYPE;
      const storageUrl = await uploadArtifact(
        avatarRenderRequest.job.teamId,
        payload.jobId,
        AVATAR_RENDER_NODE_TYPE,
        fileName,
        outputValidation.videoBuffer,
        contentType,
        outputValidation.videoBuffer.length
      );
      const metadata = {
        ...providerOutput.metadata,
        ...outputValidation.metadata,
        provider: providerOutput.provider,
        providerRequestId: providerOutput.providerRequestId,
        resolution: providerOutput.resolution,
        model: providerOutput.model,
        mode: avatarRenderRequest.mode,
        crop: avatarRenderRequest.crop,
        aspectRatio: nodeInput.aspectRatio,
      };
      const artifact = await writeArtifact({
        jobId: payload.jobId,
        nodeId: payload.nodeId,
        type: AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
        storageUrl,
        metadata,
      });

      await prisma.avatarRenderRequest.update({
        where: {
          id: avatarRenderRequest.id,
        },
        data: {
          provider: providerOutput.provider,
          providerRequestId: providerOutput.providerRequestId,
        },
      });

      const output = {
        avatarRenderRequestId: avatarRenderRequest.id,
        videoArtifactId: artifact.id,
        storageUrl,
        provider: providerOutput.provider,
        providerRequestId: providerOutput.providerRequestId,
        metadata,
      };

      if (avatarRenderRequest.mode === "preview") {
        return {
          status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
          requiresApproval: true,
          output,
        };
      }

      return { output };
    } catch (error) {
      if (error instanceof AvatarRenderProviderError) {
        throw error;
      }
      if (error instanceof AvatarRenderOutputValidationError) {
        throw error;
      }

      throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.storageError);
    }
  };
}

async function readRegisteredLocalAvatarService(): Promise<LocalAvatarRenderServiceConfig | null> {
  return prisma.localModelService.findUnique({
    where: {
      serviceType: "avatar",
    },
    select: {
      baseUrl: true,
      status: true,
      modelName: true,
    },
  });
}

function parseAvatarRenderNodeInput(input: unknown): AvatarRenderNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }

  const value = input as {
    avatarRenderRequestId?: unknown;
    avatarId?: unknown;
    audioArtifactId?: unknown;
    mode?: unknown;
    aspectRatio?: unknown;
    sourceImageUrl?: unknown;
    audioUrl?: unknown;
    renderOptions?: unknown;
  };
  const renderOptions = parseRenderOptions(value.renderOptions);

  if (typeof value.avatarRenderRequestId !== "string" || !value.avatarRenderRequestId) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (typeof value.avatarId !== "string" || !value.avatarId) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (typeof value.audioArtifactId !== "string" || !value.audioArtifactId) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  const mode = value.mode;
  const aspectRatio = value.aspectRatio;
  if (mode !== "preview" && mode !== "hd") {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (!isApiAspectRatio(aspectRatio)) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (typeof value.sourceImageUrl !== "string" || !value.sourceImageUrl) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (typeof value.audioUrl !== "string" || !value.audioUrl) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }

  return {
    avatarRenderRequestId: value.avatarRenderRequestId,
    avatarId: value.avatarId,
    audioArtifactId: value.audioArtifactId,
    mode,
    aspectRatio,
    sourceImageUrl: value.sourceImageUrl,
    audioUrl: value.audioUrl,
    renderOptions,
  };
}

function parseRenderOptions(value: unknown): AvatarRenderOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }

  const renderOptions = value as {
    crop?: unknown;
    resolution?: unknown;
    background?: unknown;
  };
  if (!AVATAR_RENDER_CROPS.includes(renderOptions.crop as AvatarRenderCrop)) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }
  if (typeof renderOptions.resolution !== "string" || !renderOptions.resolution) {
    throw avatarRenderWorkerError(AVATAR_RENDER_ERROR_CODES.workerInputInvalid);
  }

  return {
    crop: renderOptions.crop as AvatarRenderCrop,
    resolution: renderOptions.resolution,
    ...(renderOptions.background === "transparent" ||
    renderOptions.background === "solid" ||
    renderOptions.background === "source"
      ? { background: renderOptions.background }
      : {}),
  };
}

function avatarRenderWorkerError(code: AvatarRenderErrorCode) {
  return new AvatarRenderProviderError(code, AVATAR_RENDER_ERROR_MESSAGES[code]);
}

function isApiAspectRatio(value: unknown): value is ApiAspectRatio {
  return VALID_ASPECT_RATIOS.includes(value as ApiAspectRatio);
}

async function readableToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
