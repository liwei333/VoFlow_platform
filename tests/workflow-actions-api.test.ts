import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { POST as retryNode } from "@/app/api/video-jobs/[jobId]/nodes/[nodeId]/retry/route";
import { POST as approveNode } from "@/app/api/video-jobs/[jobId]/nodes/[nodeId]/approve/route";
import { POST as cancelJob } from "@/app/api/video-jobs/[jobId]/cancel/route";

describe("workflow action APIs", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let failedNodeId: string;
  let approvalNodeId: string;
  let queuedNodeId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `workflow_actions_${Date.now()}@example.com`,
        passwordHash: "hashed_password",
        name: "Workflow Actions User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Workflow Actions Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

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
        name: "Workflow Actions Project",
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
        currentNode: "tts",
        progress: 30,
      },
    });
    jobId = job.id;

    const failedNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "tts",
        status: "failed",
        version: 1,
        input: { script: "hello" },
        output: { audioUrl: "old.wav" },
        error: {
          code: "WORKFLOW_NODE_TIMEOUT",
          message: "节点执行超时",
        },
        retryCount: 1,
      },
    });
    failedNodeId = failedNode.id;

    const queuedNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "avatar_render",
        status: "queued",
        version: 1,
      },
    });
    queuedNodeId = queuedNode.id;

    const approvalNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "legal_review",
        status: "waiting_approval",
        version: 1,
        requiresApproval: true,
      },
    });
    approvalNodeId = approvalNode.id;
  });

  afterEach(async () => {
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [
          { teamId },
          { userId },
        ],
      },
    });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("retries a failed retryable node by creating a new version and resetting downstream nodes", async () => {
    const response = await retryNode(await createRequest(), {
      params: Promise.resolve({ jobId, nodeId: failedNodeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.node).toMatchObject({
      jobId,
      nodeType: "tts",
      status: "queued",
      version: 2,
      retryCount: 2,
      input: { script: "hello" },
    });

    const originalNode = await prisma.workflowNode.findUnique({ where: { id: failedNodeId } });
    expect(originalNode?.status).toBe("failed");

    const downstreamNode = await prisma.workflowNode.findUnique({ where: { id: queuedNodeId } });
    expect(downstreamNode?.status).toBe("pending");
  });

  it("approves a waiting approval node", async () => {
    const response = await approveNode(await createRequest(), {
      params: Promise.resolve({ jobId, nodeId: approvalNodeId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.node).toMatchObject({
      id: approvalNodeId,
      status: "approved",
      approvedByUserId: userId,
    });
    expect(body.data.node.approvedAt).toBeTruthy();

    const approvedNode = await prisma.workflowNode.findUnique({
      where: { id: approvalNodeId },
      select: { approvedByUserId: true, approvedAt: true },
    });
    expect(approvedNode?.approvedByUserId).toBe(userId);
    expect(approvedNode?.approvedAt).toBeInstanceOf(Date);
  });

  it("cancels unfinished workflow nodes and the job while preserving completed nodes", async () => {
    await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "reference_extract",
        status: "approved",
        version: 1,
      },
    });

    const response = await cancelJob(await createRequest(), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.job).toMatchObject({
      id: jobId,
      status: "cancelled",
    });

    const nodes = await prisma.workflowNode.findMany({
      where: { jobId },
      select: { nodeType: true, status: true },
    });
    expect(nodes.find((node) => node.nodeType === "reference_extract")?.status).toBe("approved");
    expect(nodes.find((node) => node.nodeType === "avatar_render")?.status).toBe("cancelled");
  });

  async function createRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "workflow-actions@example.com",
      name: "Workflow Actions User",
    });

    return new NextRequest("http://localhost:3000/api/video-jobs/actions", {
      method: "POST",
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
