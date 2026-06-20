import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveScriptCandidate } from "@/services/scriptCandidateApprovalService";

describe("approveScriptCandidate", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let otherProjectId: string;
  let jobId: string;
  let otherJobId: string;
  let scriptId: string;
  let candidateId: string;
  let siblingCandidateId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_candidate_approval_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Candidate Approval User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Candidate Approval Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Script Candidate Approval Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    const project = await createProject("Script Candidate Approval Project", teamId);
    projectId = project.id;
    const otherProject = await createProject("Other Script Candidate Approval Project", otherTeamId);
    otherProjectId = otherProject.id;

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

    const otherJob = await prisma.videoJob.create({
      data: {
        projectId: otherProjectId,
        teamId: otherTeamId,
        ownerId: userId,
        status: "running",
        currentNode: "script_prepare",
      },
    });
    otherJobId = otherJob.id;

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

    const sibling = await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "其他候选文案",
        version: 1,
        status: "draft",
      },
    });
    siblingCandidateId = sibling.id;
  });

  afterEach(async () => {
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: { in: [jobId, otherJobId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires explicit confirmation before approving a candidate with risk hits", async () => {
    const result = await approveScriptCandidate({
      candidateId,
      jobId,
      teamId,
      confirmRisk: false,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "RISK_CONFIRMATION_REQUIRED" },
    });

    const candidate = await prisma.scriptCandidate.findUnique({ where: { id: candidateId } });
    expect(candidate?.status).toBe("draft");

    const script = await prisma.script.findUnique({ where: { id: scriptId } });
    expect(script).toMatchObject({
      jobId: null,
      status: "ready",
    });
  });

  it("approves the candidate and binds the parent script to the video job after risk confirmation", async () => {
    const result = await approveScriptCandidate({
      candidateId,
      jobId,
      teamId,
      confirmRisk: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
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
    });

    const candidates = await prisma.scriptCandidate.findMany({
      where: { id: { in: [candidateId, siblingCandidateId] } },
      orderBy: { id: "asc" },
    });
    expect(candidates.find((candidate) => candidate.id === candidateId)?.status).toBe("approved");
    expect(candidates.find((candidate) => candidate.id === siblingCandidateId)?.status).toBe("rejected");

    const script = await prisma.script.findUnique({ where: { id: scriptId } });
    expect(script).toMatchObject({
      jobId,
      status: "approved",
    });
  });

  it("does not bind candidates to video jobs outside the current team", async () => {
    const result = await approveScriptCandidate({
      candidateId,
      jobId: otherJobId,
      teamId,
      confirmRisk: true,
    });

    expect(result).toEqual({
      success: false,
      error: { code: "VIDEO_JOB_NOT_FOUND" },
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
});
