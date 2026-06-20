import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/script-candidates/[candidateId]/approve/route";

describe("POST /api/script-candidates/[candidateId]/approve", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let scriptId: string;
  let candidateId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_candidate_approval_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Candidate Approval API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Candidate Approval API Team",
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
        name: "Script Candidate Approval API Project",
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
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        sourceType: "pasted",
        content: "原始口播文案",
        version: 1,
        status: "ready",
      },
    });
    scriptId = script.id;

    const candidate = await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "风险命中候选文案",
        riskReport: {
          reportType: "script_risk",
          status: "needs_review",
          requiresApproval: true,
        },
        version: 1,
        status: "draft",
      },
    });
    candidateId = candidate.id;
  });

  afterEach(async () => {
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
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

  it("requires authentication", async () => {
    const response = await POST(createJsonRequest(candidateId, { jobId }), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(401);
  });

  it("validates jobId", async () => {
    const response = await POST(await createAuthenticatedRequest(candidateId, { jobId: "" }), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["jobId"],
        }),
      ])
    );
  });

  it("requires explicit risk confirmation when the candidate risk report requires approval", async () => {
    const response = await POST(await createAuthenticatedRequest(candidateId, { jobId }), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "RISK_CONFIRMATION_REQUIRED",
      message: "风险命中候选文案必须显式确认",
    });

    const candidate = await prisma.scriptCandidate.findUnique({ where: { id: candidateId } });
    expect(candidate?.status).toBe("draft");
  });

  it("approves a risk-hit candidate after explicit confirmation", async () => {
    const response = await POST(await createAuthenticatedRequest(candidateId, { jobId, confirmRisk: true }), {
      params: Promise.resolve({ candidateId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      message: "候选文案已确认",
      data: {
        candidate: {
          id: candidateId,
          scriptId,
          content: "风险命中候选文案",
          status: "approved",
        },
        script: {
          id: scriptId,
          projectId,
          jobId,
          status: "approved",
        },
      },
    });
  });

  function createJsonRequest(targetCandidateId: string, body: unknown, cookie?: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/script-candidates/${targetCandidateId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async function createAuthenticatedRequest(targetCandidateId: string, body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "script-candidate-approval-api@example.com",
      name: "Script Candidate Approval API User",
    });

    return createJsonRequest(targetCandidateId, body, `session=${token}`);
  }
});
