import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import {
  VOICE_CLONE_MOCK_PROVIDER,
  VOICE_CLONE_NODE_TYPE,
  VOICE_CONSENT_USAGE_SCOPES,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
} from "@/lib/voice-clone/constants";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export type CreateVoiceCloneTrainingTaskInput = {
  jobId: string;
  voiceSampleId: string;
  teamId: string;
  userId: string;
};

export type CreateVoiceCloneTrainingTaskDependencies = {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
};

type VoiceCloneErrorCode =
  (typeof VOICE_SAMPLE_ERROR_CODES)[keyof typeof VOICE_SAMPLE_ERROR_CODES];

export type CreateVoiceCloneTrainingTaskResult =
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
          requiresApproval: boolean;
        };
        voiceCloneJob: {
          id: string;
          workflowNodeId: string;
          voiceSampleId: string;
          provider: string;
          status: string;
          outputVoiceId: string | null;
          errorJson: unknown;
        };
      };
    }
  | {
      success: false;
      error: {
        code: VoiceCloneErrorCode;
        message: string;
      };
    };

const defaultCreateVoiceCloneTrainingTaskDependencies: CreateVoiceCloneTrainingTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function createVoiceCloneTrainingTask(
  input: CreateVoiceCloneTrainingTaskInput,
  dependencies: Partial<CreateVoiceCloneTrainingTaskDependencies> = {}
): Promise<CreateVoiceCloneTrainingTaskResult> {
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      ownerId: input.userId,
      status: { not: "cancelled" },
    },
    select: {
      id: true,
    },
  });

  if (!job) {
    return voiceCloneError(VOICE_SAMPLE_ERROR_CODES.jobNotFound);
  }

  const voiceSample = await prisma.voiceSample.findFirst({
    where: {
      id: input.voiceSampleId,
      teamId: input.teamId,
      ownerId: input.userId,
    },
    select: {
      id: true,
      qualityReport: true,
    },
  });

  if (!voiceSample) {
    return voiceCloneError(VOICE_SAMPLE_ERROR_CODES.notFound);
  }

  if (!getVoiceSampleQualityReport(voiceSample.qualityReport)?.passed) {
    return voiceCloneError(VOICE_SAMPLE_ERROR_CODES.qualityNotPassed);
  }

  const consent = await prisma.voiceConsent.findFirst({
    where: {
      voiceSampleId: voiceSample.id,
      teamId: input.teamId,
      userId: input.userId,
      usageScope: {
        hasEvery: [...VOICE_CONSENT_USAGE_SCOPES],
      },
    },
    select: {
      id: true,
    },
  });

  if (!consent) {
    return voiceCloneError(VOICE_SAMPLE_ERROR_CODES.consentRequired);
  }

  const { queue, createTraceId } = {
    ...defaultCreateVoiceCloneTrainingTaskDependencies,
    ...dependencies,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const maxVersion = await tx.workflowNode.aggregate({
        where: {
          jobId: input.jobId,
          nodeType: VOICE_CLONE_NODE_TYPE,
        },
        _max: {
          version: true,
        },
      });
      const version = (maxVersion._max.version ?? 0) + 1;

      const node = await tx.workflowNode.create({
        data: {
          jobId: input.jobId,
          nodeType: VOICE_CLONE_NODE_TYPE,
          status: "queued",
          version,
          input: Prisma.JsonNull,
          requiresApproval: WORKFLOW_NODE_DEFINITIONS[VOICE_CLONE_NODE_TYPE].requiresApproval,
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
          requiresApproval: true,
        },
      });

      const voiceCloneJob = await tx.voiceCloneJob.create({
        data: {
          workflowNodeId: node.id,
          voiceSampleId: voiceSample.id,
          provider: VOICE_CLONE_MOCK_PROVIDER,
          status: "queued",
        },
        select: {
          id: true,
          workflowNodeId: true,
          voiceSampleId: true,
          provider: true,
          status: true,
          outputVoiceId: true,
          errorJson: true,
        },
      });

      const nodeInput = {
        voiceCloneJobId: voiceCloneJob.id,
        voiceSampleId: voiceSample.id,
        provider: VOICE_CLONE_MOCK_PROVIDER,
      };
      const updatedNode = await tx.workflowNode.update({
        where: { id: node.id },
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
          requiresApproval: true,
        },
      });

      await tx.videoJob.update({
        where: { id: input.jobId },
        data: {
          status: "queued",
          currentNode: VOICE_CLONE_NODE_TYPE,
        },
      });

      return {
        node: updatedNode,
        voiceCloneJob,
      };
    });

    await queue.enqueue({
      jobId: input.jobId,
      nodeId: result.node.id,
      nodeType: VOICE_CLONE_NODE_TYPE,
      version: result.node.version,
      traceId: createTraceId(),
    });

    return {
      success: true,
      data: result,
    };
  } catch {
    return voiceCloneError(VOICE_SAMPLE_ERROR_CODES.taskCreateFailed);
  }
}

function getVoiceSampleQualityReport(value: Prisma.JsonValue): { passed?: boolean } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as { passed?: boolean };
}

function voiceCloneError(
  code: VoiceCloneErrorCode
): Extract<CreateVoiceCloneTrainingTaskResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: VOICE_SAMPLE_ERROR_MESSAGES[code],
    },
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
