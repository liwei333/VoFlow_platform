import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runScriptRiskCheck } from "@/services/scriptRiskService";

describe("runScriptRiskCheck", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let scriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_risk_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Risk User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Risk Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Script Risk Project",
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
        currentNode: "legal_review",
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "legal_review",
        status: "running",
        version: 1,
        input: {
          sourceType: "risk_check",
        },
      },
    });
    nodeId = node.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "pasted",
        content: "这款产品绝对第一",
        version: 1,
        status: "ready",
      },
    });
    scriptId = script.id;
  });

  afterEach(async () => {
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.workflowNode.deleteMany({ where: { id: nodeId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("writes risk_report_json and moves the node to waiting_approval when risk is hit", async () => {
    const result = await runScriptRiskCheck({
      scriptId,
      content: "这款产品绝对第一",
      nodeId,
    });

    expect(result.report).toMatchObject({
      status: "needs_review",
      requiresApproval: true,
    });

    const candidate = await prisma.scriptCandidate.findFirst({
      where: { scriptId },
    });
    expect(candidate).toMatchObject({
      scriptId,
      content: "这款产品绝对第一",
      status: "draft",
      version: 1,
    });
    expect(candidate?.riskReport).toMatchObject({
      reportType: "script_risk",
      status: "needs_review",
      requiresApproval: true,
    });

    const node = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
    });
    expect(node).toMatchObject({
      status: "waiting_approval",
      requiresApproval: true,
    });
    expect(node?.output).toMatchObject({
      riskReport: {
        status: "needs_review",
      },
    });
  });
});
