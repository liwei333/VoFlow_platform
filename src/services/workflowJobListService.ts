import { Prisma, VideoJobStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  serializeWorkflowJobSummaries,
  type SerializedWorkflowJobSummary,
  type WorkflowJobSummaryRecord,
} from "@/lib/workflow/serializer";

export interface ListWorkflowJobsInput {
  teamId: string;
  projectId?: string;
  status?: VideoJobStatus;
  page: number;
  pageSize: number;
}

export interface WorkflowJobListPage {
  jobs: WorkflowJobSummaryRecord[];
  total: number;
}

export interface WorkflowJobListRepository {
  findJobs(input: ListWorkflowJobsInput): Promise<WorkflowJobListPage>;
}

export interface ListWorkflowJobsDependencies {
  repository: WorkflowJobListRepository;
}

export interface ListWorkflowJobsOutput {
  jobs: SerializedWorkflowJobSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const prismaWorkflowJobListRepository: WorkflowJobListRepository = {
  async findJobs(input) {
    const where: Prisma.VideoJobWhereInput = {
      teamId: input.teamId,
    };

    if (input.projectId) {
      where.projectId = input.projectId;
    }

    if (input.status) {
      where.status = input.status;
    }

    const skip = (input.page - 1) * input.pageSize;

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: input.pageSize,
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
        },
      }),
      prisma.videoJob.count({ where }),
    ]);

    return { jobs, total };
  },
};

const defaultListWorkflowJobsDependencies: ListWorkflowJobsDependencies = {
  repository: prismaWorkflowJobListRepository,
};

export async function listWorkflowJobs(
  input: ListWorkflowJobsInput,
  dependencies: Partial<ListWorkflowJobsDependencies> = {}
): Promise<ListWorkflowJobsOutput> {
  const { repository } = {
    ...defaultListWorkflowJobsDependencies,
    ...dependencies,
  };

  const page = await repository.findJobs(input);

  return {
    jobs: serializeWorkflowJobSummaries(page.jobs),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / input.pageSize),
    },
  };
}
