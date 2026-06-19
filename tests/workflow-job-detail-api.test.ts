import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { GET } from "@/app/api/video-jobs/[jobId]/route";

describe("GET /api/video-jobs/[jobId]", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let nodeIds: string[];

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `workflow_detail_${Date.now()}@example.com`,
        passwordHash: "hashed_password",
        name: "Workflow Detail User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Workflow Detail Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Workflow Detail Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: "member",
      },
    });

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Workflow Detail Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "running",
        currentNode: "script_prepare",
        progress: 15,
      },
    });
    jobId = job.id;

    const firstNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "reference_extract",
        status: "approved",
        version: 1,
        output: { summary: "ok" },
      },
    });
    const oldScriptNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "script_prepare",
        status: "failed",
        version: 1,
        error: {
          code: "WORKFLOW_NODE_TIMEOUT",
          message: "旧版本超时",
        },
      },
    });
    const latestScriptNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "script_prepare",
        status: "running",
        version: 2,
        input: { topic: "summer" },
      },
    });
    nodeIds = [firstNode.id, oldScriptNode.id, latestScriptNode.id];

    await prisma.artifact.create({
      data: {
        jobId,
        nodeId: latestScriptNode.id,
        type: "script",
        storageUrl: "voflow/team/assets/script.json",
        metadata: { wordCount: 120 },
      },
    });
  });

  afterEach(async () => {
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { id: { in: nodeIds } } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [
          { teamId },
          { teamId: otherTeamId },
          { userId },
        ],
      },
    });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("returns job details with latest workflow nodes and artifact summaries", async () => {
    const response = await GET(await createRequest(teamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.job).toMatchObject({
      id: jobId,
      projectId,
      teamId,
      ownerId: userId,
      status: "running",
      currentNode: "script_prepare",
      progress: 15,
      errorCode: null,
      errorMessage: null,
    });
    expect(body.data.job.nodes).toHaveLength(2);
    expect(body.data.job.nodes.map((node: { nodeType: string }) => node.nodeType)).toEqual([
      "reference_extract",
      "script_prepare",
    ]);
    expect(body.data.job.nodes[1]).toMatchObject({
      nodeType: "script_prepare",
      status: "running",
      version: 2,
      input: { topic: "summer" },
      error: null,
      retryable: true,
    });
    expect(body.data.job.artifacts).toHaveLength(1);
    expect(body.data.job.artifacts[0]).toMatchObject({
      jobId,
      nodeId: body.data.job.nodes[1].id,
      type: "script",
      storageUrl: "voflow/team/assets/script.json",
      metadata: { wordCount: 120 },
    });
  });

  it("returns 404 for a job outside the current team", async () => {
    await prisma.teamMember.create({
      data: {
        teamId: otherTeamId,
        userId,
        role: "member",
      },
    });

    const response = await GET(await createRequest(otherTeamId), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "工作流任务不存在",
    });
  });

  it("returns 404 when the job does not exist", async () => {
    const response = await GET(await createRequest(teamId), {
      params: Promise.resolve({ jobId: "missing-job" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "工作流任务不存在",
    });
  });

  async function createRequest(requestTeamId: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId: requestTeamId,
      email: "workflow-detail@example.com",
      name: "Workflow Detail User",
    });

    return new NextRequest(`http://localhost:3000/api/video-jobs/${jobId}`, {
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
