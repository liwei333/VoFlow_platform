import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST as createLegalReview } from "@/app/api/script-candidates/[candidateId]/legal-review/route";
import { GET as getLegalReview } from "@/app/api/legal-reviews/[reviewId]/route";
import { POST as replaceAllLegalRiskItems } from "@/app/api/legal-reviews/[reviewId]/replace-all/route";
import { POST as resolveLegalRiskItem } from "@/app/api/legal-risk-items/[itemId]/resolve/route";

describe("legal review APIs", () => {
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
        email: `legal_review_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Legal Review API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Legal Review API Team",
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
        name: "Legal Review API Project",
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
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("creates, reads, replaces, and resolves legal review risk items", async () => {
    const createResponse = await createLegalReview(await createRequest({ jobId }), {
      params: Promise.resolve({ candidateId }),
    });
    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json();
    expect(createBody.code).toBe("SUCCESS");
    expect(createBody.data.review.status).toBe("waiting_approval");
    expect(createBody.data.riskItems).toHaveLength(2);

    const reviewId = createBody.data.review.id as string;
    const riskItemId = createBody.data.riskItems[0].id as string;

    const getResponse = await getLegalReview(await createRequest(), {
      params: Promise.resolve({ reviewId }),
    });
    expect(getResponse.status).toBe(200);
    const getBody = await getResponse.json();
    expect(getBody.data.review.id).toBe(reviewId);

    const invalidResolveResponse = await resolveLegalRiskItem(
      await createRequest({ action: "ignored" }),
      {
        params: Promise.resolve({ itemId: riskItemId }),
      }
    );
    expect(invalidResolveResponse.status).toBe(400);
    await expect(invalidResolveResponse.json()).resolves.toMatchObject({
      code: "LEGAL_IGNORE_REASON_REQUIRED",
    });

    const replaceResponse = await replaceAllLegalRiskItems(await createRequest(), {
      params: Promise.resolve({ reviewId }),
    });
    expect(replaceResponse.status).toBe(200);
    const replaceBody = await replaceResponse.json();
    expect(replaceBody.data.review).toMatchObject({
      status: "approved",
      resolvedScript: "这款产品表现出色，7 天改善反复问题。",
    });
  });

  async function createRequest(body?: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "legal-review-api@example.com",
      name: "Legal Review API User",
    });

    return new NextRequest("http://localhost:3000/api/legal-review-test", {
      method: body === undefined ? "GET" : "POST",
      headers: {
        cookie: `session=${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
});
