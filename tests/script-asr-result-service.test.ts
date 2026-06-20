import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveAsrTranscriptionResult } from "@/services/scriptService";

describe("saveAsrTranscriptionResult", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_asr_result_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script ASR Result User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script ASR Result Team",
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
        name: "Script ASR Result Project",
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
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: { script: { projectId } },
    });
    await prisma.scriptCandidate.deleteMany({
      where: { script: { projectId } },
    });
    await prisma.script.deleteMany({ where: { projectId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("writes an ASR script and its segments for the workflow job", async () => {
    const script = await saveAsrTranscriptionResult({
      jobId,
      assetId: "asset-1",
      assetType: "audio",
      durationMs: 2200,
      text: "欢迎来到 VoFlow",
      segments: [
        { startMs: 0, endMs: 1200, text: "欢迎来到" },
        { startMs: 1200, endMs: 2200, text: "VoFlow" },
      ],
      provider: "mock-asr",
    });

    expect(script).toMatchObject({
      projectId,
      jobId,
      sourceType: "asr",
      content: "欢迎来到 VoFlow",
      metadata: {
        assetId: "asset-1",
        assetType: "audio",
        durationMs: 2200,
        provider: "mock-asr",
      },
      version: 1,
      status: "ready",
    });

    const segments = await prisma.asrSegment.findMany({
      where: { scriptId: script.id },
      orderBy: { startMs: "asc" },
    });

    expect(segments).toHaveLength(2);
    expect(segments).toEqual([
      expect.objectContaining({
        scriptId: script.id,
        startMs: 0,
        endMs: 1200,
        text: "欢迎来到",
      }),
      expect.objectContaining({
        scriptId: script.id,
        startMs: 1200,
        endMs: 2200,
        text: "VoFlow",
      }),
    ]);
  });
});
