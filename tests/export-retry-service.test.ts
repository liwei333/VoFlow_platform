import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { createFinalExportTask } from "@/services/exportTaskService";
import { createFinalExportWorkflowNodeHandler } from "@/services/exportWorkerService";
import { executeWorkflowNode } from "@/services/workflowWorkerService";
import { retryWorkflowNode } from "@/services/workflowActionsService";

describe("final export failure retry", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let sourceNodeId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `export_retry_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Export Retry User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Export Retry Team",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Export Retry Project",
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
      },
    });
    jobId = job.id;

    const sourceNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "avatar_render",
        status: "succeeded",
        version: 1,
      },
    });
    sourceNodeId = sourceNode.id;

    await prisma.artifact.createMany({
      data: [
        {
          jobId,
          nodeId: sourceNodeId,
          type: "avatar_video",
          storageUrl: "voflow/team/jobs/job-1/avatar_render/avatar.mp4",
        },
        {
          jobId,
          nodeId: sourceNodeId,
          type: "mixed_audio",
          storageUrl: "voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav",
        },
        {
          jobId,
          nodeId: sourceNodeId,
          type: "subtitle",
          storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.ass",
          metadata: {
            format: "ass",
          },
        },
      ],
    });

    await prisma.editingConfig.create({
      data: {
        jobId,
      },
    });
  });

  afterEach(async () => {
    await prisma.exportRequest.deleteMany({ where: { jobId } });
    await prisma.editingConfig.deleteMany({ where: { jobId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("marks failed final_export requests, retries the node, and writes a new final_video artifact", async () => {
    const queuedPayloads: WorkflowQueuePayload[] = [];
    const queue = createCollectingQueue(queuedPayloads);
    const task = await createFinalExportTask(
      {
        jobId,
        teamId,
        outputProfile: "mp4_1080p",
      },
      {
        queue,
        createTraceId: () => "trace-final-export-first",
      }
    );

    expect(task.success).toBe(true);
    const firstPayload = queuedPayloads[0];
    expect(firstPayload).toBeDefined();

    const failedExecution = await executeWorkflowNode(firstPayload, {
      handlers: {
        final_export: createFinalExportWorkflowNodeHandler({
          materializeObject: async (storageUrl) => `/tmp/${storageUrl.split("/").at(-1)}`,
          executeFfmpeg: async () => {
            throw new Error("ffmpeg failed");
          },
          readOutputFile: async () => Buffer.from("unused"),
          validateFinalVideo: async () => ({ valid: true }),
          uploadFinalVideo: async () => "unused",
        }),
      },
    });

    expect(failedExecution).toEqual({
      success: false,
      error: {
        code: "EXPORT_FFMPEG_FAILED",
        message: "ffmpeg failed",
      },
    });

    const failedNode = await prisma.workflowNode.findUniqueOrThrow({
      where: {
        id: firstPayload.nodeId,
      },
      select: {
        status: true,
        error: true,
      },
    });
    expect(failedNode.status).toBe("failed");
    expect(failedNode.error).toMatchObject({
      code: "EXPORT_FFMPEG_FAILED",
      message: "ffmpeg failed",
    });

    const failedRequest = await prisma.exportRequest.findFirstOrThrow({
      where: {
        jobId,
      },
      select: {
        id: true,
        status: true,
        errorJson: true,
      },
    });
    expect(failedRequest).toMatchObject({
      status: "failed",
      errorJson: {
        code: "EXPORT_FFMPEG_FAILED",
        message: "ffmpeg failed",
      },
    });
    await expect(
      prisma.artifact.count({
        where: {
          jobId,
          type: "final_video",
        },
      })
    ).resolves.toBe(0);

    const retry = await retryWorkflowNode(
      {
        jobId,
        teamId,
        nodeId: firstPayload.nodeId,
      },
      {
        queue,
        createTraceId: () => "trace-final-export-retry",
      }
    );

    expect(retry).toMatchObject({
      success: true,
      data: {
        node: {
          nodeType: "final_export",
          status: "queued",
          version: 2,
          retryCount: 1,
        },
      },
    });
    const retryPayload = queuedPayloads[1];
    expect(retryPayload).toMatchObject({
      jobId,
      nodeType: "final_export",
      version: 2,
      traceId: "trace-final-export-retry",
    });

    const successfulExecution = await executeWorkflowNode(retryPayload, {
      handlers: {
        final_export: createFinalExportWorkflowNodeHandler({
          materializeObject: async (storageUrl) => `/tmp/${storageUrl.split("/").at(-1)}`,
          executeFfmpeg: async () => undefined,
          readOutputFile: async () => Buffer.from("final-video-after-retry"),
          validateFinalVideo: async () => ({ valid: true }),
          uploadFinalVideo: async (input) =>
            `voflow/${input.teamId}/jobs/${input.jobId}/final_export/final_video-retry.mp4`,
        }),
      },
    });

    expect(successfulExecution.success).toBe(true);
    const succeededRequest = await prisma.exportRequest.findFirstOrThrow({
      where: {
        id: failedRequest.id,
      },
      select: {
        status: true,
        errorJson: true,
      },
    });
    expect(succeededRequest.status).toBe("succeeded");
    expect(succeededRequest.errorJson).toBeNull();

    const finalVideo = await prisma.artifact.findFirstOrThrow({
      where: {
        jobId,
        type: "final_video",
      },
      select: {
        nodeId: true,
        storageUrl: true,
        metadata: true,
      },
    });
    expect(finalVideo).toMatchObject({
      nodeId: retryPayload.nodeId,
      storageUrl: `voflow/${teamId}/jobs/${jobId}/final_export/final_video-retry.mp4`,
      metadata: {
        exportRequestId: failedRequest.id,
        outputProfile: "mp4_1080p",
      },
    });
  });
});

function createCollectingQueue(payloads: WorkflowQueuePayload[]) {
  return {
    enqueue: async (payload: WorkflowQueuePayload) => {
      payloads.push(payload);
    },
    retry: async (payload: WorkflowQueuePayload) => {
      payloads.push(payload);
    },
    cancel: async () => undefined,
    getQueue: () => [...payloads],
    clear: () => {
      payloads.splice(0, payloads.length);
    },
  };
}
