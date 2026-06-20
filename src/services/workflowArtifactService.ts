import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface WriteWorkflowArtifactInput {
  jobId: string;
  nodeId: string;
  type: string;
  storageUrl: string;
  metadata?: unknown;
}

export interface WorkflowArtifactRecord {
  id: string;
  jobId: string;
  nodeId: string;
  type: string;
  storageUrl: string;
  metadata: unknown;
  createdAt: Date;
}

export interface WriteWorkflowArtifactRepositoryInput extends WriteWorkflowArtifactInput {
  metadata: unknown;
}

export interface WorkflowArtifactRepository {
  createArtifact(input: WriteWorkflowArtifactRepositoryInput): Promise<WorkflowArtifactRecord>;
}

export interface WriteWorkflowArtifactDependencies {
  repository: WorkflowArtifactRepository;
}

const prismaWorkflowArtifactRepository: WorkflowArtifactRepository = {
  async createArtifact(input) {
    return prisma.artifact.create({
      data: {
        jobId: input.jobId,
        nodeId: input.nodeId,
        type: input.type,
        storageUrl: input.storageUrl,
        metadata: toPrismaJson(input.metadata),
      },
      select: {
        id: true,
        jobId: true,
        nodeId: true,
        type: true,
        storageUrl: true,
        metadata: true,
        createdAt: true,
      },
    });
  },
};

const defaultWriteWorkflowArtifactDependencies: WriteWorkflowArtifactDependencies = {
  repository: prismaWorkflowArtifactRepository,
};

export async function writeWorkflowArtifact(
  input: WriteWorkflowArtifactInput,
  dependencies: Partial<WriteWorkflowArtifactDependencies> = {}
): Promise<WorkflowArtifactRecord> {
  const { repository } = {
    ...defaultWriteWorkflowArtifactDependencies,
    ...dependencies,
  };

  return repository.createArtifact({
    ...input,
    metadata: input.metadata ?? null,
  });
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
