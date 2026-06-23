import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/voices/clone/route";

const PASSED_QUALITY_REPORT = {
  passed: true,
  durationMs: 12000,
  averageVolumeDb: -18,
  silenceRatio: 0.05,
  noiseLevel: 0.1,
  reasons: [],
};

describe("POST /api/voices/clone", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let voiceSampleId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `voice_clone_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Voice Clone API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Voice Clone API Team",
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
        name: "Voice Clone API Project",
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
        currentNode: "voice_clone",
      },
    });
    jobId = job.id;

    voiceSampleId = await createAuthorizedVoiceSample();
  });

  afterEach(async () => {
    await prisma.voiceCloneJob.deleteMany({ where: { voiceSample: { teamId } } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.voiceConsent.deleteMany({ where: { teamId } });
    await prisma.voiceSample.deleteMany({ where: { teamId } });
    await prisma.asset.deleteMany({ where: { teamId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await POST(createJsonRequest({ jobId, voiceSampleId }));

    expect(response.status).toBe(401);
  });

  it("creates a local voice clone training task for an authorized sample", async () => {
    const response = await POST(await createAuthenticatedJsonRequest({ jobId, voiceSampleId }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        node: {
          jobId,
          nodeType: "voice_clone",
          status: "queued",
        },
        voiceCloneJob: {
          voiceSampleId,
          provider: "mock",
          status: "queued",
        },
      },
    });

    await expect(prisma.workflowNode.count({ where: { jobId, nodeType: "voice_clone" } })).resolves.toBe(1);
    await expect(prisma.voiceCloneJob.count({ where: { voiceSampleId } })).resolves.toBe(1);
  });

  async function createAuthorizedVoiceSample() {
    const asset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: "audio",
        name: "Voice Clone API Sample",
        storageUrl: `voflow/${teamId}/assets/voice-clone-api-sample/raw/voice.wav`,
        mimeType: "audio/wav",
        sizeBytes: BigInt(5000),
        metadata: {
          sourceType: "voice_sample",
          durationMs: 12000,
          qualityReport: PASSED_QUALITY_REPORT,
        },
        licenseStatus: "approved",
      },
    });

    const sample = await prisma.voiceSample.create({
      data: {
        teamId,
        ownerId: userId,
        assetId: asset.id,
        durationMs: 12000,
        qualityReport: PASSED_QUALITY_REPORT,
      },
    });

    await prisma.voiceConsent.create({
      data: {
        voiceSampleId: sample.id,
        teamId,
        userId,
        consentText: "我确认上传声音为本人声音或已获得合法授权，并同意用于声音克隆和 TTS 生成。",
        usageScope: ["voice_clone", "tts_generation"],
      },
    });

    return sample.id;
  }

  async function createAuthenticatedJsonRequest(body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "voice-clone-api@example.com",
      name: "Voice Clone API User",
    });

    return createJsonRequest(body, `session=${token}`);
  }

  function createJsonRequest(body: unknown, cookie?: string): NextRequest {
    return new NextRequest("http://localhost:3000/api/voices/clone", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  }
});
