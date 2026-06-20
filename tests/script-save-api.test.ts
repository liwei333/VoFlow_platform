import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/projects/[projectId]/scripts/route";

describe("POST /api/projects/[projectId]/scripts", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_save_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Save User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Save Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Script Save Team",
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

    const project = await createProject("Script Save Project", teamId);
    projectId = project.id;
    const otherProject = await createProject("Other Script Save Project", otherTeamId);
    otherProjectId = otherProject.id;
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: { script: { projectId: { in: [projectId, otherProjectId] } } },
    });
    await prisma.scriptCandidate.deleteMany({
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
    const response = await POST(createJsonRequest(projectId, { content: "hello" }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(401);
  });

  it("rejects empty script content", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { content: "   " }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["content"],
        }),
      ])
    );
  });

  it("rejects script content over 3000 characters", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { content: "字".repeat(3001) }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["content"],
        }),
      ])
    );
  });

  it("returns 404 for a project outside the current team", async () => {
    const response = await POST(await createAuthenticatedRequest(otherProjectId, { content: "跨团队文案" }), {
      params: Promise.resolve({ projectId: otherProjectId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "项目不存在",
    });
  });

  it("saves pasted script content as version 1", async () => {
    const response = await POST(await createAuthenticatedRequest(projectId, { content: "  这是一段口播文案  " }), {
      params: Promise.resolve({ projectId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.message).toBe("文案保存成功");
    expect(body.data.script).toMatchObject({
      projectId,
      jobId: null,
      sourceType: "pasted",
      content: "这是一段口播文案",
      metadata: null,
      version: 1,
      status: "draft",
    });
    expect(typeof body.data.script.createdAt).toBe("string");
    expect(typeof body.data.script.updatedAt).toBe("string");

    const saved = await prisma.script.findUnique({
      where: { id: body.data.script.id },
    });
    expect(saved).toMatchObject({
      projectId,
      jobId: null,
      sourceType: "pasted",
      content: "这是一段口播文案",
      version: 1,
      status: "draft",
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

  function createJsonRequest(targetProjectId: string, body: unknown, cookie?: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/projects/${targetProjectId}/scripts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async function createAuthenticatedRequest(targetProjectId: string, body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "script-save@example.com",
      name: "Script Save User",
    });

    return createJsonRequest(targetProjectId, body, `session=${token}`);
  }
});
