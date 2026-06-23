import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/storage", () => ({
  ensureBucketExists: vi.fn().mockResolvedValue(undefined),
  uploadAsset: vi.fn().mockImplementation((teamId: string, assetId: string, fileName: string) =>
    Promise.resolve(`voflow/${teamId}/assets/${assetId}/raw/${fileName}`)
  ),
  deleteAsset: vi.fn().mockResolvedValue(undefined),
  getMinioDiagnostics: vi.fn((error?: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error ?? ""),
  })),
  generatePresignedUrl: vi.fn().mockResolvedValue("signed://voice-sample"),
}));

import { POST } from "@/app/api/voices/samples/route";
import { POST as confirmVoiceSampleConsent } from "@/app/api/voices/samples/[sampleId]/consents/route";

describe("POST /api/voices/samples", () => {
  let userId: string;
  let teamId: string;
  let otherTeamIds: string[];

  beforeEach(async () => {
    otherTeamIds = [];
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `voice_sample_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Voice Sample User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Voice Sample Team",
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
  });

  afterEach(async () => {
    const teamIds = [teamId, ...otherTeamIds];
    await prisma.voiceCloneJob.deleteMany({ where: { voiceSample: { teamId: { in: teamIds } } } });
    await prisma.voiceConsent.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.voiceSample.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.auditLog.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.asset.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    const response = await POST(createMultipartRequest());

    expect(response.status).toBe(401);
  });

  it("rejects non-audio files before creating an asset or voice sample", async () => {
    const response = await POST(
      await createAuthenticatedMultipartRequest({
        file: new File([new Uint8Array([1, 2, 3])], "sample.png", { type: "image/png" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      errorCode: "UNSUPPORTED_MIME_TYPE",
    });

    await expect(prisma.asset.count({ where: { teamId } })).resolves.toBe(0);
    await expect(prisma.voiceSample.count({ where: { teamId } })).resolves.toBe(0);
  });

  it("uploads an audio asset and creates voice_sample metadata for the current team", async () => {
    const response = await POST(await createAuthenticatedMultipartRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        voiceSample: {
          teamId,
          ownerId: userId,
          durationMs: 12000,
          qualityReport: {
            passed: true,
            reasons: [],
          },
          asset: {
            type: "audio",
            mimeType: "audio/wav",
            licenseStatus: "pending",
          },
        },
      },
    });

    const persisted = await prisma.voiceSample.findUnique({
      where: { id: body.data.voiceSample.id },
      include: { asset: true },
    });
    expect(persisted).toMatchObject({
      teamId,
      ownerId: userId,
      durationMs: 12000,
      qualityReport: {
        passed: true,
        durationMs: 12000,
        averageVolumeDb: -18,
        silenceRatio: 0.05,
        noiseLevel: 0.1,
        reasons: [],
      },
      asset: {
        teamId,
        ownerId: userId,
        type: "audio",
        name: "我的声音样本",
        mimeType: "audio/wav",
        licenseStatus: "pending",
        metadata: {
          sourceType: "voice_sample",
          durationMs: 12000,
        },
      },
    });
  });

  it("rejects voice samples that are shorter than the configured minimum duration", async () => {
    const response = await POST(
      await createAuthenticatedMultipartRequest({
        durationMs: "3000",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VOICE_SAMPLE_TOO_SHORT",
      data: {
        qualityReport: {
          passed: false,
          reasons: [
            {
              code: "VOICE_SAMPLE_TOO_SHORT",
            },
          ],
        },
      },
    });

    await expect(prisma.asset.count({ where: { teamId } })).resolves.toBe(0);
    await expect(prisma.voiceSample.count({ where: { teamId } })).resolves.toBe(0);
  });

  it("rejects voice samples with too much silence or noise", async () => {
    const response = await POST(
      await createAuthenticatedMultipartRequest({
        silenceRatio: "0.8",
        noiseLevel: "0.9",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VOICE_SAMPLE_QUALITY_NOT_PASSED",
      data: {
        qualityReport: {
          passed: false,
          silenceRatio: 0.8,
          noiseLevel: 0.9,
          reasons: expect.arrayContaining([
            expect.objectContaining({ code: "VOICE_SAMPLE_SILENCE_TOO_HIGH" }),
            expect.objectContaining({ code: "VOICE_SAMPLE_NOISY" }),
          ]),
        },
      },
    });

    await expect(prisma.asset.count({ where: { teamId } })).resolves.toBe(0);
    await expect(prisma.voiceSample.count({ where: { teamId } })).resolves.toBe(0);
  });

  it("requires voice clone and TTS generation usage scopes when confirming voice consent", async () => {
    const sample = await createPersistedVoiceSample();

    const response = await confirmVoiceSampleConsent(
      await createAuthenticatedJsonRequest({
        consentText: "我确认授权该声音用于声音克隆",
        usageScope: ["voice_clone"],
      }),
      { params: Promise.resolve({ sampleId: sample.id }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VOICE_SAMPLE_CONSENT_REQUIRED",
    });
    await expect(prisma.voiceConsent.count({ where: { voiceSampleId: sample.id } })).resolves.toBe(0);
  });

  it("writes voice consent for a qualified sample and approves the sample asset", async () => {
    const sample = await createPersistedVoiceSample();

    const response = await confirmVoiceSampleConsent(
      await createAuthenticatedJsonRequest({
        consentText: "我确认上传声音为本人声音或已获得合法授权，并同意用于声音克隆和 TTS 生成。",
        usageScope: ["voice_clone", "tts_generation"],
        deviceJson: { userAgent: "vitest" },
      }),
      { params: Promise.resolve({ sampleId: sample.id }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        voiceSample: {
          id: sample.id,
          asset: {
            id: sample.assetId,
            licenseStatus: "approved",
          },
        },
        consent: {
          voiceSampleId: sample.id,
          teamId,
          userId,
          usageScope: ["voice_clone", "tts_generation"],
        },
      },
    });

    const persistedConsent = await prisma.voiceConsent.findFirst({
      where: { voiceSampleId: sample.id },
    });
    expect(persistedConsent).toMatchObject({
      teamId,
      userId,
      consentText: "我确认上传声音为本人声音或已获得合法授权，并同意用于声音克隆和 TTS 生成。",
      usageScope: ["voice_clone", "tts_generation"],
      ipAddress: "203.0.113.10",
      device: { userAgent: "vitest" },
    });

    const asset = await prisma.asset.findUnique({ where: { id: sample.assetId } });
    expect(asset?.licenseStatus).toBe("approved");
  });

  it("does not confirm consent for another team's voice sample", async () => {
    const sample = await createPersistedVoiceSample({ team: await createOtherTeam() });

    const response = await confirmVoiceSampleConsent(
      await createAuthenticatedJsonRequest({
        consentText: "我确认上传声音为本人声音或已获得合法授权，并同意用于声音克隆和 TTS 生成。",
        usageScope: ["voice_clone", "tts_generation"],
      }),
      { params: Promise.resolve({ sampleId: sample.id }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "VOICE_SAMPLE_NOT_FOUND",
    });
    await expect(prisma.voiceConsent.count({ where: { voiceSampleId: sample.id } })).resolves.toBe(0);
  });

  function createMultipartRequest(
    options: {
      file?: File;
      cookie?: string;
      durationMs?: string;
      averageVolumeDb?: string;
      silenceRatio?: string;
      noiseLevel?: string;
    } = {}
  ): NextRequest {
    const formData = new FormData();
    formData.set(
      "file",
      options.file ?? new File([new Uint8Array([1, 2, 3, 4])], "voice.wav", { type: "audio/wav" })
    );
    formData.set("name", "我的声音样本");
    formData.set("durationMs", options.durationMs ?? "12000");
    if (options.averageVolumeDb) {
      formData.set("averageVolumeDb", options.averageVolumeDb);
    }
    if (options.silenceRatio) {
      formData.set("silenceRatio", options.silenceRatio);
    }
    if (options.noiseLevel) {
      formData.set("noiseLevel", options.noiseLevel);
    }

    return new NextRequest("http://localhost:3000/api/voices/samples", {
      method: "POST",
      headers: options.cookie ? { cookie: options.cookie } : undefined,
      body: formData,
    });
  }

  async function createAuthenticatedMultipartRequest(
    options: {
      file?: File;
      durationMs?: string;
      averageVolumeDb?: string;
      silenceRatio?: string;
      noiseLevel?: string;
    } = {}
  ) {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "voice-sample@example.com",
      name: "Voice Sample User",
    });

    return createMultipartRequest({
      file: options.file,
      cookie: `session=${token}`,
      durationMs: options.durationMs,
      averageVolumeDb: options.averageVolumeDb,
      silenceRatio: options.silenceRatio,
      noiseLevel: options.noiseLevel,
    });
  }

  async function createAuthenticatedJsonRequest(body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "voice-sample@example.com",
      name: "Voice Sample User",
    });

    return new NextRequest("http://localhost:3000/api/voices/samples/sample-id/consents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.10",
        cookie: `session=${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function createOtherTeam() {
    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Voice Sample Team",
        ownerId: userId,
      },
    });
    otherTeamIds.push(otherTeam.id);

    return otherTeam.id;
  }

  async function createPersistedVoiceSample(options: { team?: string } = {}) {
    const sampleTeamId = options.team ?? teamId;
    const asset = await prisma.asset.create({
      data: {
        teamId: sampleTeamId,
        ownerId: userId,
        type: "audio",
        name: "Qualified Voice Sample",
        storageUrl: `voflow/${sampleTeamId}/assets/voice-sample/raw/voice.wav`,
        mimeType: "audio/wav",
        sizeBytes: BigInt(5000),
        metadata: {
          sourceType: "voice_sample",
          durationMs: 12000,
          qualityReport: {
            passed: true,
            durationMs: 12000,
            averageVolumeDb: -18,
            silenceRatio: 0.05,
            noiseLevel: 0.1,
            reasons: [],
          },
        },
        licenseStatus: "pending",
      },
    });

    return prisma.voiceSample.create({
      data: {
        teamId: sampleTeamId,
        ownerId: userId,
        assetId: asset.id,
        durationMs: 12000,
        qualityReport: {
          passed: true,
          durationMs: 12000,
          averageVolumeDb: -18,
          silenceRatio: 0.05,
          noiseLevel: 0.1,
          reasons: [],
        },
      },
    });
  }
});
