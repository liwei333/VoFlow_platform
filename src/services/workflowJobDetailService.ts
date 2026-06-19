import { prisma } from "@/lib/db";
import {
  serializeWorkflowJobDetail,
  type SerializedWorkflowJobDetail,
  type WorkflowJobDetailRecord,
} from "@/lib/workflow/serializer";
import {
  WORKFLOW_ERROR_CODES,
  workflowError,
  type WorkflowError,
} from "@/lib/workflow/errors";

export interface GetWorkflowJobDetailInput {
  jobId: string;
  teamId: string;
}

export interface WorkflowJobDetailRepository {
  findJobDetail(input: GetWorkflowJobDetailInput): Promise<WorkflowJobDetailRecord | null>;
}

export interface GetWorkflowJobDetailDependencies {
  repository: WorkflowJobDetailRepository;
}

export type GetWorkflowJobDetailResult =
  | { success: true; data: SerializedWorkflowJobDetail }
  | { success: false; error: WorkflowError };

const prismaWorkflowJobDetailRepository: WorkflowJobDetailRepository = {
  async findJobDetail({ jobId, teamId }) {
    return prisma.videoJob.findFirst({
      where: {
        id: jobId,
        teamId,
      },
      select: {
        id: true,
        projectId: true,
        teamId: true,
        ownerId: true,
        status: true,
        currentNode: true,
        progress: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        nodes: {
          select: {
            id: true,
            jobId: true,
            nodeType: true,
            status: true,
            version: true,
            input: true,
            output: true,
            error: true,
            retryCount: true,
            requiresApproval: true,
            startedAt: true,
            finishedAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [
            { nodeType: "asc" },
            { version: "desc" },
            { createdAt: "desc" },
          ],
        },
        artifacts: {
          select: {
            id: true,
            jobId: true,
            nodeId: true,
            type: true,
            storageUrl: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  },
};

const defaultGetWorkflowJobDetailDependencies: GetWorkflowJobDetailDependencies = {
  repository: prismaWorkflowJobDetailRepository,
};

export async function getWorkflowJobDetail(
  input: GetWorkflowJobDetailInput,
  dependencies: Partial<GetWorkflowJobDetailDependencies> = {}
): Promise<GetWorkflowJobDetailResult> {
  const { repository } = {
    ...defaultGetWorkflowJobDetailDependencies,
    ...dependencies,
  };

  const job = await repository.findJobDetail(input);

  if (!job) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND),
    };
  }

  return {
    success: true,
    data: serializeWorkflowJobDetail(job),
  };
}
