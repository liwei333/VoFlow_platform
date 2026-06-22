import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  assertLegalReviewResolvedForTts,
  createLegalReviewForCandidate,
  replaceAllLegalRiskItems,
  resolveLegalRiskItem,
} from "@/services/legalReviewService";

describe("legal review service", () => {
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
        email: `legal_review_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Legal Review User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Legal Review Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Legal Review Project",
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
        currentNode: "legal_review",
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "generated",
        content: "原始文案",
        version: 1,
        status: "approved",
      },
    });
    scriptId = script.id;

    const candidate = await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "这款产品绝对第一，7 天治愈反复问题。",
        version: 1,
        status: "approved",
      },
    });
    candidateId = candidate.id;
  });

  afterEach(async () => {
    await prisma.legalRiskItem.deleteMany({
      where: {
        legalReview: {
          scriptCandidateId: candidateId,
        },
      },
    });
    await prisma.legalReview.deleteMany({ where: { scriptCandidateId: candidateId } });
    await prisma.auditLog.deleteMany({ where: { teamId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates a waiting review with typed risk items for an approved script candidate", async () => {
    const result = await createLegalReviewForCandidate({
      candidateId,
      jobId,
      teamId,
      userId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.review).toMatchObject({
      scriptCandidateId: candidateId,
      jobId,
      status: "waiting_approval",
      reviewedScript: "这款产品绝对第一，7 天治愈反复问题。",
    });
    expect(result.data.review.summaryJson).toMatchObject({
      requiresApproval: true,
      counts: {
        exaggeration: 1,
        fact: 1,
      },
    });
    expect(result.data.riskItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          riskType: "exaggeration",
          severity: "high",
          originalText: "绝对第一",
          action: "pending",
        }),
        expect.objectContaining({
          riskType: "fact",
          severity: "high",
          originalText: "治愈",
          action: "pending",
        }),
      ])
    );
  });

  it("applies every replaceable suggestion and marks risk items as replaced", async () => {
    const created = await createLegalReviewForCandidate({ candidateId, jobId, teamId, userId });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await replaceAllLegalRiskItems({
      reviewId: created.data.review.id,
      teamId,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.review.resolvedScript).toBe("这款产品表现出色，7 天改善反复问题。");
    expect(result.data.review.status).toBe("approved");
    expect(result.data.riskItems.every((item) => item.action === "replaced")).toBe(true);
  });

  it("rejects ignored risk items without a reason and writes audit logs when ignored", async () => {
    const created = await createLegalReviewForCandidate({ candidateId, jobId, teamId, userId });
    expect(created.success).toBe(true);
    if (!created.success) return;
    const riskItemId = created.data.riskItems[0].id;

    await expect(
      resolveLegalRiskItem({
        riskItemId,
        teamId,
        userId,
        action: "ignored",
      })
    ).resolves.toEqual({
      success: false,
      error: {
        code: "LEGAL_IGNORE_REASON_REQUIRED",
        message: "忽略风险必须填写原因",
      },
    });

    const ignored = await resolveLegalRiskItem({
      riskItemId,
      teamId,
      userId,
      action: "ignored",
      ignoredReason: "已有线下审批材料",
    });

    expect(ignored.success).toBe(true);
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        teamId,
        action: "legal_risk_resolve",
        targetId: riskItemId,
      },
    });
    expect(auditLog?.metadata).toMatchObject({
      action: "ignored",
      ignoredReason: "已有线下审批材料",
    });
  });

  it("blocks TTS while high-risk legal items remain pending", async () => {
    await createLegalReviewForCandidate({ candidateId, jobId, teamId, userId });

    const result = await assertLegalReviewResolvedForTts({
      scriptCandidateId: candidateId,
      teamId,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "LEGAL_HIGH_RISK_UNRESOLVED",
        message: "存在未处理高风险法务项，不能进入声音生成",
      },
    });
  });
});
