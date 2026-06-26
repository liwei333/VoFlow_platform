import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  EDITING_ERROR_CODES,
  EDITING_PREVIEW_ARTIFACT_TYPE,
  EDITING_PREVIEW_CONTENT_TYPE,
  EDITING_PREVIEW_NODE_TYPE,
} from "@/lib/editing/constants";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { createEditingPreviewWorkflowNodeHandler } from "@/services/editingPreviewWorkerService";
import { writeWorkflowArtifact } from "@/services/workflowArtifactService";
import {
  createDefaultWorkflowNodeHandlers,
  executeWorkflowNode,
} from "@/services/workflowWorkerService";

describe("editing preview worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `editing_preview_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Editing Preview Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Editing Preview Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Editing Preview Worker Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "running",
        currentNode: EDITING_PREVIEW_NODE_TYPE,
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: EDITING_PREVIEW_NODE_TYPE,
        status: "queued",
        version: 1,
      },
    });
    nodeId = node.id;
  });

  afterEach(async () => {
    await prisma.editingConfig.deleteMany({ where: { jobId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("registers editing_preview in the default workflow handlers", () => {
    expect(createDefaultWorkflowNodeHandlers().editing_preview).toEqual(expect.any(Function));
  });

  it("writes a lightweight preview config artifact and links it to editing config", async () => {
    const editingConfig = await prisma.editingConfig.create({
      data: {
        jobId,
        subtitleEnabled: true,
        keywordHighlightEnabled: true,
        bgmDuckingEnabled: true,
        pipEnabled: false,
        pipPosition: "top_right",
        pipSize: 25,
        voiceVolume: 90,
        bgmVolume: 20,
        transitionStrength: 30,
        configJson: {
          keywordHighlight: {
            enabled: true,
            keywords: ["智能补光镜"],
          },
        },
      },
    });
    const uploadArtifact = vi
      .fn()
      .mockResolvedValue(`voflow/${teamId}/jobs/${jobId}/editing_preview/${editingConfig.id}.json`);
    const handler = createEditingPreviewWorkflowNodeHandler({
      uploadArtifact,
      writeArtifact: writeWorkflowArtifact,
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await handler({
      payload: {
        jobId,
        nodeId,
        nodeType: EDITING_PREVIEW_NODE_TYPE,
        version: 1,
        traceId: "trace-editing-preview",
      },
      input: {},
    });

    expect(result.status).toBe(WORKFLOW_NODE_STATUS.WAITING_APPROVAL);
    expect(result.requiresApproval).toBe(true);
    expect(uploadArtifact).toHaveBeenCalledWith(
      teamId,
      jobId,
      EDITING_PREVIEW_NODE_TYPE,
      `${editingConfig.id}.json`,
      expect.any(Buffer),
      EDITING_PREVIEW_CONTENT_TYPE,
      expect.any(Number)
    );
    expect(result.output).toMatchObject({
      previewType: "lightweight_config",
      previewArtifactId: expect.any(String),
      storageUrl: `voflow/${teamId}/jobs/${jobId}/editing_preview/${editingConfig.id}.json`,
      metadata: {
        generatedAt: "2026-06-24T00:00:00.000Z",
        editingConfigId: editingConfig.id,
      },
    });

    const artifact = await prisma.artifact.findFirstOrThrow({
      where: {
        jobId,
        nodeId,
        type: EDITING_PREVIEW_ARTIFACT_TYPE,
      },
    });
    expect(artifact.storageUrl).toBe(
      `voflow/${teamId}/jobs/${jobId}/editing_preview/${editingConfig.id}.json`
    );
    expect(artifact.metadata).toMatchObject({
      previewType: "lightweight_config",
      editingConfigId: editingConfig.id,
    });

    const savedConfig = await prisma.editingConfig.findUniqueOrThrow({
      where: {
        id: editingConfig.id,
      },
    });
    expect(savedConfig.previewArtifactId).toBe(artifact.id);
  });

  it("fails with a stable error when editing config is missing", async () => {
    const handler = createEditingPreviewWorkflowNodeHandler({
      uploadArtifact: vi.fn(),
      writeArtifact: writeWorkflowArtifact,
    });

    await expect(
      handler({
        payload: {
          jobId,
          nodeId,
          nodeType: EDITING_PREVIEW_NODE_TYPE,
          version: 1,
          traceId: "trace-editing-preview",
        },
        input: {},
      })
    ).rejects.toMatchObject({
      code: EDITING_ERROR_CODES.previewFailed,
      message: "剪辑预览生成失败",
    });
  });

  it("records preview failures on the workflow node error field", async () => {
    const result = await executeWorkflowNode({
      jobId,
      nodeId,
      nodeType: EDITING_PREVIEW_NODE_TYPE,
      version: 1,
      traceId: "trace-editing-preview",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: EDITING_ERROR_CODES.previewFailed,
        message: "剪辑预览生成失败",
      },
    });

    const failedNode = await prisma.workflowNode.findUniqueOrThrow({
      where: {
        id: nodeId,
      },
    });
    expect(failedNode.status).toBe(WORKFLOW_NODE_STATUS.FAILED);
    expect(failedNode.error).toEqual({
      code: EDITING_ERROR_CODES.previewFailed,
      message: "剪辑预览生成失败",
    });
  });
});
