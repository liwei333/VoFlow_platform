import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { GET } from "@/app/api/video-jobs/route";

describe("GET /api/video-jobs", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectIds: string[];
  let otherProjectId: string;
  let jobIds: string[];
  let otherJobId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `workflow_list_${Date.now()}@example.com`,
        passwordHash: "hashed_password",
        name: "Workflow List User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Workflow List Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Workflow List Team",
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

    const firstProject = await createProject("First Workflow List Project", teamId);
    const secondProject = await createProject("Second Workflow List Project", teamId);
    const otherProject = await createProject("Other Workflow List Project", otherTeamId);
    projectIds = [firstProject.id, secondProject.id];
    otherProjectId = otherProject.id;

    const firstJob = await prisma.videoJob.create({
      data: {
        projectId: firstProject.id,
        teamId,
        ownerId: userId,
        status: "running",
        currentNode: "script_prepare",
        progress: 15,
      },
    });
    const secondJob = await prisma.videoJob.create({
      data: {
        projectId: secondProject.id,
        teamId,
        ownerId: userId,
        status: "failed",
        currentNode: "tts",
        progress: 38,
        errorCode: "WORKFLOW_NODE_TIMEOUT",
        errorMessage: "节点执行超时",
      },
    });
    const thirdJob = await prisma.videoJob.create({
      data: {
        projectId: firstProject.id,
        teamId,
        ownerId: userId,
        status: "succeeded",
        currentNode: null,
        progress: 100,
      },
    });
    const otherJob = await prisma.videoJob.create({
      data: {
        projectId: otherProject.id,
        teamId: otherTeamId,
        ownerId: userId,
        status: "running",
        currentNode: "publish",
        progress: 92,
      },
    });

    jobIds = [firstJob.id, secondJob.id, thirdJob.id];
    otherJobId = otherJob.id;
  });

  afterEach(async () => {
    await prisma.artifact.deleteMany({
      where: {
        OR: [
          { jobId: { in: jobIds } },
          { jobId: otherJobId },
        ],
      },
    });
    await prisma.workflowNode.deleteMany({
      where: {
        OR: [
          { jobId: { in: jobIds } },
          { jobId: otherJobId },
        ],
      },
    });
    await prisma.videoJob.deleteMany({
      where: { id: { in: [...jobIds, otherJobId] } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [...projectIds, otherProjectId] } },
    });
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

  it("lists only jobs in the current team with pagination", async () => {
    const response = await GET(await createRequest("/api/video-jobs?page=1&pageSize=2"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.jobs).toHaveLength(2);
    expect(body.data.jobs.map((job: { id: string }) => job.id)).not.toContain(otherJobId);
    expect(body.data.pagination).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(body.data.jobs[0]).toMatchObject({
      teamId,
      ownerId: userId,
    });
    expect(typeof body.data.jobs[0].createdAt).toBe("string");
    expect(typeof body.data.jobs[0].updatedAt).toBe("string");
  });

  it("filters jobs by projectId and status within the current team", async () => {
    const response = await GET(
      await createRequest(`/api/video-jobs?projectId=${projectIds[0]}&status=running`)
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.jobs).toHaveLength(1);
    expect(body.data.jobs[0]).toMatchObject({
      id: jobIds[0],
      projectId: projectIds[0],
      teamId,
      status: "running",
      currentNode: "script_prepare",
      progress: 15,
      errorCode: null,
      errorMessage: null,
    });
    expect(body.data.pagination.total).toBe(1);
  });

  it("returns validation error for invalid filters", async () => {
    const response = await GET(await createRequest("/api/video-jobs?status=unknown"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("参数错误");
    expect(body.errors.length).toBeGreaterThan(0);
  });

  async function createProject(name: string, projectTeamId: string) {
    return prisma.project.create({
      data: {
        teamId: projectTeamId,
        ownerId: userId,
        name,
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
  }

  async function createRequest(path: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "workflow-list@example.com",
      name: "Workflow List User",
    });

    return new NextRequest(`http://localhost:3000${path}`, {
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
