import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  EDITING_ERROR_CODES,
  EDITING_PREVIEW_NODE_TYPE,
} from "@/lib/editing/constants";
import { createEditingPreviewTask } from "@/services/editingPreviewTaskService";

describe("createEditingPreviewTask", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `editing_preview_task_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Editing Preview Task User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Editing Preview Task Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Editing Preview Task Project",
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
        currentNode: "avatar_render",
      },
    });
    jobId = job.id;
  });

  afterEach(async () => {
    await prisma.editingConfig.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates an editing_preview node and enqueues it", async () => {
    const editingConfig = await prisma.editingConfig.create({
      data: {
        jobId,
        subtitleEnabled: true,
        keywordHighlightEnabled: true,
        bgmDuckingEnabled: true,
        pipEnabled: false,
        pipPosition: "top_right",
        pipSize: 25,
        voiceVolume: 100,
        bgmVolume: 35,
        transitionStrength: 50,
      },
    });
    const enqueue = vi.fn().mockResolvedValue(undefined);

    const result = await createEditingPreviewTask(
      {
        jobId,
        teamId,
      },
      {
        queue: { enqueue },
        createTraceId: () => "trace-editing-preview",
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.node).toMatchObject({
      jobId,
      nodeType: EDITING_PREVIEW_NODE_TYPE,
      status: "queued",
      version: 1,
      input: {
        editingConfigId: editingConfig.id,
        previewType: "lightweight_config",
      },
    });
    expect(enqueue).toHaveBeenCalledWith({
      jobId,
      nodeId: result.data.node.id,
      nodeType: EDITING_PREVIEW_NODE_TYPE,
      version: 1,
      traceId: "trace-editing-preview",
    });

    const job = await prisma.videoJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("queued");
    expect(job.currentNode).toBe(EDITING_PREVIEW_NODE_TYPE);
  });

  it("rejects preview creation when editing config is missing", async () => {
    const result = await createEditingPreviewTask(
      {
        jobId,
        teamId,
      },
      {
        queue: { enqueue: vi.fn() },
        createTraceId: () => "trace-editing-preview",
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: EDITING_ERROR_CODES.previewFailed,
        message: "剪辑预览生成失败",
      },
    });
  });
});
