import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createFinalExportTask } from "@/services/exportTaskService";

describe("create final export task", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let sourceNodeId: string;
  let avatarVideoArtifactId: string;
  let audioArtifactId: string;
  let subtitleArtifactId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `export_task_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Export Task User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Export Task Team",
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
        name: "Export Task Project",
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

    const [avatarVideo, audio, subtitle] = await Promise.all([
      prisma.artifact.create({
        data: {
          jobId,
          nodeId: sourceNodeId,
          type: "avatar_video",
          storageUrl: "voflow/team/jobs/job-1/avatar_render/avatar.mp4",
        },
      }),
      prisma.artifact.create({
        data: {
          jobId,
          nodeId: sourceNodeId,
          type: "mixed_audio",
          storageUrl: "voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav",
        },
      }),
      prisma.artifact.create({
        data: {
          jobId,
          nodeId: sourceNodeId,
          type: "subtitle",
          storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.ass",
          metadata: {
            format: "ass",
          },
        },
      }),
    ]);
    avatarVideoArtifactId = avatarVideo.id;
    audioArtifactId = audio.id;
    subtitleArtifactId = subtitle.id;

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
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates export request, final_export node, and enqueues workflow", async () => {
    const queue = {
      enqueue: vi.fn().mockResolvedValue(undefined),
    };

    const result = await createFinalExportTask(
      {
        jobId,
        teamId,
        outputProfile: "mp4_1080p",
      },
      {
        queue,
        createTraceId: () => "trace-final-export",
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        exportRequest: {
          jobId,
          outputProfile: "mp4_1080p",
          avatarVideoArtifactId,
          audioArtifactId,
          subtitleArtifactId,
        },
        node: {
          nodeType: "final_export",
          status: "queued",
        },
      },
    });

    const exportRequest = await prisma.exportRequest.findFirstOrThrow({
      where: {
        jobId,
      },
    });
    expect(exportRequest.status).toBe("queued");
    expect(queue.enqueue).toHaveBeenCalledWith({
      jobId,
      nodeId: exportRequest.nodeId,
      nodeType: "final_export",
      version: 1,
      traceId: "trace-final-export",
    });
  });

  it("rejects export when required upstream artifacts are missing", async () => {
    await prisma.artifact.delete({ where: { id: avatarVideoArtifactId } });

    await expect(
      createFinalExportTask({
        jobId,
        teamId,
        outputProfile: "mp4_720p",
      })
    ).resolves.toEqual({
      success: false,
      error: {
        code: "EXPORT_INPUT_NOT_READY",
        message: "导出所需上游产物未准备完成",
      },
    });
  });
});
