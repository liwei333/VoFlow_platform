import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { SCRIPT_MAX_LENGTH } from "@/lib/scripts/ui";
import { listAvailableVoices } from "@/services/voiceService";
import { createLegalReviewForCandidate } from "@/services/legalReviewService";
import { createTtsWorkflowTask } from "@/services/ttsService";

describe("TTS services", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let scriptId: string;
  let candidateId: string;
  let voiceId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `tts_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "TTS User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "TTS Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "TTS Project",
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
        currentNode: "tts",
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "pasted",
        content: "确认后的口播文案",
        version: 1,
        status: "approved",
      },
    });
    scriptId = script.id;

    const candidate = await prisma.scriptCandidate.create({
      data: {
        scriptId,
        content: "确认后的口播文案",
        version: 1,
        status: "approved",
      },
    });
    candidateId = candidate.id;

    const voice = await prisma.voice.create({
      data: {
        teamId: null,
        ownerId: null,
        voiceType: "preset",
        name: "清亮女声",
        provider: "mock",
        modelId: "preset-clear-female",
        status: "active",
        licenseStatus: "approved",
        sampleUrl: "/samples/voices/clear-female.mp3",
        gender: "female",
        style: "test-clear",
        language: "zh-CN",
      },
    });
    voiceId = voice.id;
  });

  afterEach(async () => {
    await prisma.ttsRequest.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voice.deleteMany({ where: { id: voiceId } });
    await prisma.legalRiskItem.deleteMany({
      where: {
        legalReview: {
          scriptCandidateId: candidateId,
        },
      },
    });
    await prisma.legalReview.deleteMany({ where: { scriptCandidateId: candidateId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("lists only active approved voices and supports style filters", async () => {
    await prisma.voice.createMany({
      data: [
        {
          teamId,
          ownerId: userId,
          voiceType: "cloned",
          name: "禁用克隆音色",
          provider: "mock",
          modelId: "disabled-clone",
          status: "disabled",
          licenseStatus: "approved",
          style: "test-clear",
          language: "zh-CN",
        },
        {
          teamId,
          ownerId: userId,
          voiceType: "cloned",
          name: "未授权克隆音色",
          provider: "mock",
          modelId: "rejected-clone",
          status: "active",
          licenseStatus: "rejected",
          style: "test-clear",
          language: "zh-CN",
        },
      ],
    });

    const result = await listAvailableVoices({
      teamId,
      filters: {
        style: "test-clear",
        language: "zh-CN",
      },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.voices.map((voice) => voice.name)).toEqual(["清亮女声"]);
    expect(result.success && result.data.voices[0]).toMatchObject({
      provider: "mock",
      modelId: "preset-clear-female",
      sampleUrl: "/samples/voices/clear-female.mp3",
    });
  });

  it("rejects TTS task creation when approved script content exceeds the limit", async () => {
    await prisma.scriptCandidate.update({
      where: { id: candidateId },
      data: {
        content: "字".repeat(SCRIPT_MAX_LENGTH + 1),
      },
    });

    const result = await createTtsWorkflowTask({
      jobId,
      teamId,
      userId,
      scriptCandidateId: candidateId,
      voiceId,
      params: {
        speed: 1,
        pitch: 0,
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "TTS_SCRIPT_TOO_LONG",
        message: "文案超过 3000 字限制",
      },
    });
  });

  it("rejects TTS task creation while high-risk legal review items are unresolved", async () => {
    await prisma.scriptCandidate.update({
      where: { id: candidateId },
      data: {
        content: "这款产品绝对第一",
      },
    });
    const review = await createLegalReviewForCandidate({
      candidateId,
      jobId,
      teamId,
      userId,
    });
    expect(review.success).toBe(true);

    const result = await createTtsWorkflowTask({
      jobId,
      teamId,
      userId,
      scriptCandidateId: candidateId,
      voiceId,
      params: {
        speed: 1,
        pitch: 0,
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "LEGAL_HIGH_RISK_UNRESOLVED",
        message: "存在未处理高风险法务项，不能进入声音生成",
      },
    });
  });

  it("creates a queued TTS node and request for an approved candidate and voice", async () => {
    const enqueued: unknown[] = [];
    const result = await createTtsWorkflowTask(
      {
        jobId,
        teamId,
        userId,
        scriptCandidateId: candidateId,
        voiceId,
        params: {
          speed: 1.05,
          pitch: 1,
        },
      },
      {
        queue: {
          enqueue: async (payload) => {
            enqueued.push(payload);
          },
        },
        createTraceId: () => "trace-tts",
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.node).toMatchObject({
      jobId,
      nodeType: "tts",
      status: "queued",
      version: 1,
    });
    expect(result.success && result.data.ttsRequest).toMatchObject({
      jobId,
      voiceId,
      scriptCandidateId: candidateId,
      speed: 1.05,
      pitch: 1,
      provider: "mock",
    });
    expect(enqueued).toEqual([
      {
        jobId,
        nodeId: result.success && result.data.node.id,
        nodeType: "tts",
        version: 1,
        traceId: "trace-tts",
      },
    ]);
  });
});
