import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";
import { GET as listTtsResults } from "@/app/api/video-jobs/[jobId]/tts/route";

describe("TTS APIs", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let scriptId: string;
  let candidateId: string;
  let voiceId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `tts_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "TTS API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "TTS API Team",
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
        name: "TTS API Project",
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
        version: 1,
        requiresApproval: true,
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
        storageUrl: "voflow/team/jobs/job/tts/request.wav",
        metadata: { durationMs: 2400 },
      },
    });

    await prisma.ttsRequest.create({
      data: {
        jobId,
        nodeId,
        voiceId,
        scriptCandidateId: candidateId,
        speed: 1,
        pitch: 0,
        provider: "mock",
        status: "waiting_approval",
        audioArtifactId: artifact.id,
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
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("lists TTS results for the selected job", async () => {
    const response = await listTtsResults(await createRequest(), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.code).toBe("SUCCESS");
    expect(body.data.results).toHaveLength(1);
    expect(body.data.results[0]).toMatchObject({
      jobId,
      node: {
        id: nodeId,
        status: "waiting_approval",
      },
      voice: {
        name: "清亮女声",
      },
      audioArtifact: {
        type: "audio",
        storageUrl: "voflow/team/jobs/job/tts/request.wav",
      },
    });
  });

  async function createRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "tts-api@example.com",
      name: "TTS API User",
    });

    return new NextRequest(`http://localhost:3000/api/video-jobs/${jobId}/tts`, {
      method: "GET",
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
