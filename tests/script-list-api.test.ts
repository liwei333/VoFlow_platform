import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET } from "@/app/api/projects/[projectId]/scripts/route";

describe("GET /api/projects/[projectId]/scripts", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;
  let scriptId: string;
  let otherScriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_list_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script List User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script List Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Script List Team",
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

    const project = await createProject("Script List Project", teamId);
    projectId = project.id;
    const otherProject = await createProject("Other Script List Project", otherTeamId);
    otherProjectId = otherProject.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        sourceType: "pasted",
        content: "这是一段口播文案",
        version: 1,
        status: "ready",
      },
    });
    scriptId = script.id;

    await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "候选口播文案",
        titleCandidates: ["标题1", "标题2", "标题3", "标题4", "标题5"],
        riskReport: {
          reportType: "script_risk",
          status: "needs_review",
          requiresApproval: true,
          findings: [
            {
              type: "sensitive_word",
              keyword: "绝对",
              severity: "high",
              message: "命中敏感词",
            },
          ],
        },
        modelName: "qwen-local",
        version: 2,
        status: "draft",
      },
    });

    await prisma.asrSegment.createMany({
      data: [
        {
          scriptId,
          startMs: 0,
          endMs: 10_000,
          text: "第一段转写",
        },
        {
          scriptId,
          startMs: 10_000,
          endMs: 25_000,
          text: "第二段转写",
        },
      ],
    });

    const otherScript = await prisma.script.create({
      data: {
        projectId: otherProjectId,
        sourceType: "pasted",
        content: "跨团队文案",
        version: 1,
        status: "ready",
      },
    });
    otherScriptId = otherScript.id;
  });

  afterEach(async () => {
    await prisma.scriptCandidate.deleteMany({
      where: { script: { projectId: { in: [projectId, otherProjectId] } } },
    });
    await prisma.asrSegment.deleteMany({
      where: { script: { projectId: { in: [projectId, otherProjectId] } } },
    });
    await prisma.script.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
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

  it("requires authentication", async () => {
    const response = await GET(createJsonRequest(projectId), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(401);
  });

  it("returns scripts with candidates, title candidates, and risk report for the current team project", async () => {
    const response = await GET(await createAuthenticatedRequest(projectId), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.scripts).toHaveLength(1);
    expect(body.data.scripts[0]).toMatchObject({
      id: scriptId,
      projectId,
      content: "这是一段口播文案",
      asrSegments: [
        {
          startMs: 0,
          endMs: 10_000,
          text: "第一段转写",
        },
        {
          startMs: 10_000,
          endMs: 25_000,
          text: "第二段转写",
        },
      ],
      candidates: [
        {
          content: "候选口播文案",
          titleCandidates: ["标题1", "标题2", "标题3", "标题4", "标题5"],
          riskReport: {
            status: "needs_review",
            requiresApproval: true,
          },
          modelName: "qwen-local",
          version: 2,
          status: "draft",
        },
      ],
    });
  });

  it("returns 404 for a project outside the current team", async () => {
    const response = await GET(await createAuthenticatedRequest(otherProjectId), {
      params: Promise.resolve({ projectId: otherProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "项目不存在",
    });
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

  function createJsonRequest(targetProjectId: string, cookie?: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/projects/${targetProjectId}/scripts`, {
      method: "GET",
      headers: {
        ...(cookie ? { cookie } : {}),
      },
    });
  }

  async function createAuthenticatedRequest(targetProjectId: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "script-list@example.com",
      name: "Script List User",
    });

    return createJsonRequest(targetProjectId, `session=${token}`);
  }
});
