import {
  EDITING_ERROR_CODES,
  EDITING_ERROR_MESSAGES,
  EDITING_PREVIEW_ARTIFACT_TYPE,
  EDITING_PREVIEW_CONTENT_TYPE,
  EDITING_PREVIEW_FILE_EXTENSION,
  EDITING_PREVIEW_NODE_TYPE,
} from "@/lib/editing/constants";
import { serializeEditingConfig } from "@/lib/editing/serializer";
import { prisma } from "@/lib/db";
import { uploadJobArtifact } from "@/lib/storage";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import { writeWorkflowArtifact } from "@/services/workflowArtifactService";

export type EditingPreviewType = "lightweight_config";

export interface EditingPreviewWorkflowNodeHandlerDependencies {
  uploadArtifact: typeof uploadJobArtifact;
  writeArtifact: typeof writeWorkflowArtifact;
  now: () => Date;
}

export class EditingPreviewWorkerError extends Error {
  code: typeof EDITING_ERROR_CODES.previewFailed;

  constructor() {
    super(EDITING_ERROR_MESSAGES[EDITING_ERROR_CODES.previewFailed]);
    this.name = "EditingPreviewWorkerError";
    this.code = EDITING_ERROR_CODES.previewFailed;
  }
}

const defaultEditingPreviewWorkflowNodeHandlerDependencies: EditingPreviewWorkflowNodeHandlerDependencies = {
  uploadArtifact: uploadJobArtifact,
  writeArtifact: writeWorkflowArtifact,
  now: () => new Date(),
};

export function createEditingPreviewWorkflowNodeHandler(
  dependencies: Partial<EditingPreviewWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { uploadArtifact, writeArtifact, now } = {
    ...defaultEditingPreviewWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload }) => {
    const editingConfig = await prisma.editingConfig.findFirst({
      where: {
        jobId: payload.jobId,
        job: {
          id: payload.jobId,
        },
      },
      include: {
        job: {
          select: {
            teamId: true,
          },
        },
        previewArtifact: {
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

    if (!editingConfig) {
      throw new EditingPreviewWorkerError();
    }

    const generatedAt = now().toISOString();
    const previewPayload = {
      version: 1,
      previewType: "lightweight_config" satisfies EditingPreviewType,
      generatedAt,
      jobId: payload.jobId,
      nodeId: payload.nodeId,
      traceId: payload.traceId,
      config: serializeEditingConfig(editingConfig),
    };
    const previewBuffer = Buffer.from(JSON.stringify(previewPayload, null, 2), "utf8");
    const fileName = `${editingConfig.id}.${EDITING_PREVIEW_FILE_EXTENSION}`;
    const storageUrl = await uploadArtifact(
      editingConfig.job.teamId,
      payload.jobId,
      EDITING_PREVIEW_NODE_TYPE,
      fileName,
      previewBuffer,
      EDITING_PREVIEW_CONTENT_TYPE,
      previewBuffer.length
    );
    const metadata = {
      previewType: previewPayload.previewType,
      generatedAt,
      editingConfigId: editingConfig.id,
      contentType: EDITING_PREVIEW_CONTENT_TYPE,
      sizeBytes: previewBuffer.length,
    };
    const artifact = await writeArtifact({
      jobId: payload.jobId,
      nodeId: payload.nodeId,
      type: EDITING_PREVIEW_ARTIFACT_TYPE,
      storageUrl,
      metadata,
    });

    await prisma.editingConfig.update({
      where: {
        id: editingConfig.id,
      },
      data: {
        previewArtifactId: artifact.id,
      },
    });

    return {
      status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
      requiresApproval: true,
      output: {
        previewType: previewPayload.previewType,
        previewArtifactId: artifact.id,
        storageUrl,
        metadata,
      },
    };
  };
}
