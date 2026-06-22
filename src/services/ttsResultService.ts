import { prisma } from "@/lib/db";
import { generatePresignedObjectUrl } from "@/lib/storage";

export const TTS_AUDIO_ACCESS_URL_EXPIRES_SECONDS = 60 * 60;

export type SerializedTtsResult = {
  id: string;
  jobId: string;
  status: string;
  speed: number;
  pitch: number;
  pauseJson: unknown;
  provider: string;
  providerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
  } | null;
  voice: {
    id: string;
    name: string;
    provider: string;
    modelId: string;
  };
  scriptCandidate: {
    id: string;
    contentPreview: string;
  };
  audioArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    accessUrl: string;
    metadata: unknown;
    createdAt: string;
  } | null;
};

export type ListTtsResultsForJobInput = {
  jobId: string;
  teamId: string;
};

export type ListTtsResultsForJobResult =
  | {
      success: true;
      data: {
        results: SerializedTtsResult[];
      };
    }
  | {
      success: false;
      error: {
        code: "TTS_JOB_NOT_FOUND" | "TTS_RESULT_LIST_FAILED";
        message: string;
      };
    };

type GenerateArtifactAccessUrl = (
  storageUrl: string,
  expiresInSeconds: number
) => Promise<string>;

export type ListTtsResultsForJobDependencies = {
  generateArtifactAccessUrl: GenerateArtifactAccessUrl;
  onAccessUrlError: (error: unknown, storageUrl: string) => void;
};

const defaultListTtsResultsForJobDependencies: ListTtsResultsForJobDependencies = {
  generateArtifactAccessUrl: generatePresignedObjectUrl,
  onAccessUrlError: () => undefined,
};

export async function listTtsResultsForJob(
  input: ListTtsResultsForJobInput,
  dependencies: Partial<ListTtsResultsForJobDependencies> = {}
): Promise<ListTtsResultsForJobResult> {
  const { generateArtifactAccessUrl, onAccessUrlError } = {
    ...defaultListTtsResultsForJobDependencies,
    ...dependencies,
  };

  try {
    const job = await prisma.videoJob.findFirst({
      where: {
        id: input.jobId,
        teamId: input.teamId,
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      return {
        success: false,
        error: {
          code: "TTS_JOB_NOT_FOUND",
          message: "视频任务不存在",
        },
      };
    }

    const requests = await prisma.ttsRequest.findMany({
      where: {
        jobId: input.jobId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        node: {
          select: {
            id: true,
            status: true,
            version: true,
            requiresApproval: true,
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
        audioArtifact: {
          select: {
            id: true,
            type: true,
            storageUrl: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        results: await Promise.all(
          requests.map((request) =>
            serializeTtsResult(request, {
              generateArtifactAccessUrl,
              onAccessUrlError,
            })
          )
        ),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "TTS_RESULT_LIST_FAILED",
        message: error instanceof Error ? error.message : "TTS 结果加载失败",
      },
    };
  }
}

type TtsResultRecord = Awaited<
  ReturnType<typeof prisma.ttsRequest.findMany>
>[number] & {
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
  } | null;
  voice: {
    id: string;
    name: string;
    provider: string;
    modelId: string;
  };
  scriptCandidate: {
    id: string;
    content: string;
  };
  audioArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
    createdAt: Date;
  } | null;
};

async function serializeTtsResult(
  request: TtsResultRecord,
  dependencies: ListTtsResultsForJobDependencies
): Promise<SerializedTtsResult> {
  return {
    id: request.id,
    jobId: request.jobId,
    status: request.status,
    speed: request.speed,
    pitch: request.pitch,
    pauseJson: request.pauseJson,
    provider: request.provider,
    providerRequestId: request.providerRequestId,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    node: request.node,
    voice: request.voice,
    scriptCandidate: {
      id: request.scriptCandidate.id,
      contentPreview: request.scriptCandidate.content.slice(0, 80),
    },
    audioArtifact: request.audioArtifact
      ? await serializeAudioArtifact(request.audioArtifact, dependencies)
      : null,
  };
}

async function serializeAudioArtifact(
  artifact: NonNullable<TtsResultRecord["audioArtifact"]>,
  dependencies: ListTtsResultsForJobDependencies
): Promise<NonNullable<SerializedTtsResult["audioArtifact"]>> {
  let accessUrl = "";
  try {
    accessUrl = await dependencies.generateArtifactAccessUrl(
      artifact.storageUrl,
      TTS_AUDIO_ACCESS_URL_EXPIRES_SECONDS
    );
  } catch (error) {
    dependencies.onAccessUrlError(error, artifact.storageUrl);
  }

  return {
    id: artifact.id,
    type: artifact.type,
    storageUrl: artifact.storageUrl,
    accessUrl,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt.toISOString(),
  };
}
