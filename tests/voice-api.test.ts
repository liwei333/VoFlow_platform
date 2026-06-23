import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DELETE } from "@/app/api/voices/[voiceId]/route";

describe("Voice APIs", () => {
  let userId: string;
  let teamId: string;
  let voiceId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `voice_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Voice API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Voice API Team",
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

    const voice = await prisma.voice.create({
      data: {
        teamId,
        ownerId: userId,
        voiceType: "cloned",
        name: "我的克隆音色",
        provider: "mock",
        modelId: "mock-cloned-voice",
        status: "active",
        licenseStatus: "approved",
        sampleUrl: "mock://voice.wav",
      },
    });
    voiceId = voice.id;
  });

  afterEach(async () => {
    await prisma.voice.deleteMany({ where: { id: voiceId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("disables a team cloned voice from the delete endpoint", async () => {
    const response = await DELETE(await createAuthenticatedRequest(), {
      params: Promise.resolve({ voiceId }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        voice: {
          id: voiceId,
          voiceType: "cloned",
          status: "disabled",
        },
      },
    });

    await expect(prisma.voice.findUnique({ where: { id: voiceId } })).resolves.toMatchObject({
      status: "disabled",
    });
  });

  it("does not disable preset voices from the delete endpoint", async () => {
    await prisma.voice.update({
      where: { id: voiceId },
      data: {
        voiceType: "preset",
        teamId: null,
        ownerId: null,
      },
    });

    const response = await DELETE(await createAuthenticatedRequest(), {
      params: Promise.resolve({ voiceId }),
    });

    expect(response.status).toBe(404);
    await expect(prisma.voice.findUnique({ where: { id: voiceId } })).resolves.toMatchObject({
      voiceType: "preset",
      status: "active",
    });
  });

  async function createAuthenticatedRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "voice-api@example.com",
      name: "Voice API User",
    });

    return new NextRequest(`http://localhost:3000/api/voices/${voiceId}`, {
      method: "DELETE",
      headers: {
        cookie: `session=${token}`,
      },
    });
  }
});
