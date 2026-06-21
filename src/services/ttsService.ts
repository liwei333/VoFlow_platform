import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import { SCRIPT_MAX_LENGTH } from "@/lib/scripts/ui";
import {
  TTS_ERROR_CODES,
  TTS_ERROR_MESSAGES,
  TTS_NODE_TYPE,
  type TtsErrorCode,
} from "@/lib/tts/constants";
import { ttsParamsSchema, type TtsParams } from "@/lib/tts/validation";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export type CreateTtsWorkflowTaskInput = {
  jobId: string;
  teamId: string;
  userId: string;
  scriptCandidateId: string;
  voiceId: string;
  params: Partial<TtsParams>;
};

export type CreateTtsWorkflowTaskDependencies = {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
};

export type CreateTtsWorkflowTaskResult =
  | {
      success: true;
      data: {
        node: {
          id: string;
          jobId: string;
          nodeType: string;
          status: string;
          version: number;
          input: unknown;
        };
        ttsRequest: {
          id: string;
          jobId: string;
          nodeId: string | null;
          voiceId: string;
          scriptCandidateId: string;
          speed: number;
          pitch: number;
          pauseJson: unknown;
          provider: string;
          providerRequestId: string | null;
          status: string;
        };
      };
    }
  | {
      success: false;
      error: {
        code: TtsErrorCode;
        message: string;
      };
    };

const defaultCreateTtsWorkflowTaskDependencies: CreateTtsWorkflowTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function createTtsWorkflowTask(
  input: CreateTtsWorkflowTaskInput,
  dependencies: Partial<CreateTtsWorkflowTaskDependencies> = {}
): Promise<CreateTtsWorkflowTaskResult> {
  const paramsResult = ttsParamsSchema.safeParse(input.params);
  if (!paramsResult.success) {
    return ttsError(TTS_ERROR_CODES.TTS_PARAMS_INVALID);
  }

  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      ownerId: input.userId,
      status: { not: "cancelled" },
    },
    select: {
      id: true,
      projectId: true,
      teamId: true,
    },
  });

  if (!job) {
    return ttsError(TTS_ERROR_CODES.TTS_REQUEST_CREATE_FAILED, "视频任务不存在");
  }

  const candidate = await prisma.scriptCandidate.findFirst({
    where: {
      id: input.scriptCandidateId,
      status: "approved",
      script: {
        projectId: job.projectId,
        project: {
          teamId: input.teamId,
        },
      },
    },
    select: {
      id: true,
      content: true,
    },
  });

  if (!candidate) {
    return ttsError(TTS_ERROR_CODES.TTS_REQUEST_CREATE_FAILED, "确认文案不存在");
  }

  if (candidate.content.length > SCRIPT_MAX_LENGTH) {
    return ttsError(TTS_ERROR_CODES.TTS_SCRIPT_TOO_LONG);
  }

  const voice = await prisma.voice.findFirst({
    where: {
      id: input.voiceId,
      status: "active",
      deletedAt: null,
      OR: [{ teamId: null }, { teamId: input.teamId }],
    },
    select: {
      id: true,
      provider: true,
      licenseStatus: true,
    },
  });

  if (!voice) {
    return ttsError(TTS_ERROR_CODES.VOICE_NOT_FOUND);
  }

  if (voice.licenseStatus !== "approved") {
    return ttsError(TTS_ERROR_CODES.VOICE_LICENSE_NOT_APPROVED);
  }

  const { queue, createTraceId } = {
    ...defaultCreateTtsWorkflowTaskDependencies,
    ...dependencies,
  };
  const params = paramsResult.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const maxVersion = await tx.workflowNode.aggregate({
        where: {
          jobId: input.jobId,
          nodeType: TTS_NODE_TYPE,
        },
        _max: {
          version: true,
        },
      });
      const version = (maxVersion._max.version ?? 0) + 1;

      const node = await tx.workflowNode.create({
        data: {
          jobId: input.jobId,
          nodeType: TTS_NODE_TYPE,
          status: "queued",
          version,
          input: Prisma.JsonNull,
          requiresApproval: false,
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
        },
      });

      const ttsRequest = await tx.ttsRequest.create({
        data: {
          jobId: input.jobId,
          nodeId: node.id,
          voiceId: input.voiceId,
          scriptCandidateId: input.scriptCandidateId,
          speed: params.speed,
          pitch: params.pitch,
          pauseJson: toPrismaJson(params.pauseJson),
          provider: voice.provider,
          status: "queued",
        },
        select: {
          id: true,
          jobId: true,
          nodeId: true,
          voiceId: true,
          scriptCandidateId: true,
          speed: true,
          pitch: true,
          pauseJson: true,
          provider: true,
          providerRequestId: true,
          status: true,
        },
      });

      const nodeInput = {
        ttsRequestId: ttsRequest.id,
        voiceId: input.voiceId,
        scriptCandidateId: input.scriptCandidateId,
        params,
      };
      const updatedNode = await tx.workflowNode.update({
        where: {
          id: node.id,
        },
        data: {
          input: toPrismaJson(nodeInput),
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
        },
      });

      await tx.videoJob.update({
        where: {
          id: input.jobId,
        },
        data: {
          status: "queued",
          currentNode: TTS_NODE_TYPE,
        },
      });

      return {
        node: updatedNode,
        ttsRequest,
      };
    });

    await queue.enqueue({
      jobId: input.jobId,
      nodeId: result.node.id,
      nodeType: TTS_NODE_TYPE,
      version: result.node.version,
      traceId: createTraceId(),
    });

    return {
      success: true,
      data: result,
    };
  } catch {
    return ttsError(TTS_ERROR_CODES.TTS_REQUEST_CREATE_FAILED);
  }
}

function ttsError(
  code: TtsErrorCode,
  message = TTS_ERROR_MESSAGES[code]
): Extract<CreateTtsWorkflowTaskResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
