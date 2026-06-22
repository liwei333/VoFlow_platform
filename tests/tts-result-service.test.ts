import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listTtsResultsForJob } from "@/services/ttsResultService";

describe("TTS result service", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let scriptId: string;
  let candidateId: string;
  let voiceId: string;
  let artifactId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `tts_result_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "TTS Result User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "TTS Result Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "TTS Result Project",
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

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "tts",
        status: "waiting_approval",
        version: 2,
        requiresApproval: true,
        output: {
          audioArtifactId: "placeholder",
        },
      },
    });
    nodeId = node.id;

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
      },
    });
    voiceId = voice.id;

    const artifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId,
        type: "audio",
        storageUrl: "voflow/team-1/jobs/job-1/tts/request.wav",
        metadata: {
          durationMs: 1800,
          sampleRate: 16000,
          format: "wav",
        },
      },
    });
    artifactId = artifact.id;

    await prisma.ttsRequest.create({
      data: {
        jobId,
        nodeId,
        voiceId,
        scriptCandidateId: candidateId,
        speed: 1.05,
        pitch: 1,
        provider: "mock",
        providerRequestId: "mock-request-1",
        status: "waiting_approval",
        audioArtifactId: artifactId,
      },
    });
  });

  afterEach(async () => {
    await prisma.ttsRequest.deleteMany({ where: { jobId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voice.deleteMany({ where: { id: voiceId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("returns TTS requests with node status, voice details, and playable artifact URL", async () => {
    const result = await listTtsResultsForJob(
      {
        jobId,
        teamId,
      },
      {
        generateArtifactAccessUrl: async (storageUrl, expiresInSeconds) =>
          `signed://${storageUrl}?expires=${expiresInSeconds}`,
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.results).toHaveLength(1);
    expect(result.success && result.data.results[0]).toMatchObject({
      jobId,
      node: {
        id: nodeId,
        status: "waiting_approval",
        version: 2,
        requiresApproval: true,
      },
      voice: {
        id: voiceId,
        name: "清亮女声",
      },
      scriptCandidate: {
        id: candidateId,
        contentPreview: "确认后的口播文案",
      },
      status: "waiting_approval",
      speed: 1.05,
      pitch: 1,
      audioArtifact: {
        id: artifactId,
        type: "audio",
        storageUrl: "voflow/team-1/jobs/job-1/tts/request.wav",
        accessUrl: "signed://voflow/team-1/jobs/job-1/tts/request.wav?expires=3600",
        metadata: {
          durationMs: 1800,
          sampleRate: 16000,
          format: "wav",
        },
      },
    });
  });
});
