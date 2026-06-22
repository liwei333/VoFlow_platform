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
  generatePresignedUrl: vi.fn().mockResolvedValue("signed://avatar-source"),
}));

import { POST } from "@/app/api/avatars/photo-check/route";

function pngBuffer(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(0x0d0a1a0a, 4);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("POST /api/avatars/photo-check", () => {
  let userId: string;
  let teamId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `avatar_photo_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Avatar Photo User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Avatar Photo Team",
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
    await prisma.auditLog.deleteMany({ where: { teamId } });
    await prisma.asset.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { teamId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    vi.clearAllMocks();
  });

  it("requires authentication", async () => {
    const response = await POST(createMultipartRequest());

    expect(response.status).toBe(401);
  });

  it("rejects non-avatar photo formats", async () => {
    const response = await POST(
      await createAuthenticatedMultipartRequest({
        file: new File([Buffer.from("gif")], "avatar.gif", { type: "image/gif" }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      errorCode: "UNSUPPORTED_MIME_TYPE",
    });
  });

  it("uploads an avatar_source asset and returns a quality report", async () => {
    const response = await POST(await createAuthenticatedMultipartRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "SUCCESS",
      data: {
        asset: {
          type: "avatar_source",
          mimeType: "image/png",
          licenseStatus: "pending",
        },
        qualityReport: {
          passed: true,
          faceCount: 1,
          resolution: {
            width: 1080,
            height: 1440,
          },
          reasons: [],
        },
      },
    });

    const asset = await prisma.asset.findUnique({
      where: { id: body.data.asset.id },
    });
    expect(asset).toMatchObject({
      teamId,
      ownerId: userId,
      type: "avatar_source",
      mimeType: "image/png",
      licenseStatus: "pending",
    });
    expect(asset?.metadata).toMatchObject({
      photoMetadata: {
        width: 1080,
        height: 1440,
        shortSide: 1080,
        resolutionPassed: true,
      },
      qualityReport: {
        passed: true,
        faceCount: 1,
      },
    });
  });

  function createMultipartRequest(options: { file?: File; cookie?: string } = {}): NextRequest {
    const formData = new FormData();
    formData.set(
      "file",
      options.file ?? new File([toArrayBuffer(pngBuffer(1080, 1440))], "avatar.png", { type: "image/png" })
    );
    formData.set("name", "我的数字人源照片");

    return new NextRequest("http://localhost:3000/api/avatars/photo-check", {
      method: "POST",
      headers: options.cookie ? { cookie: options.cookie } : undefined,
      body: formData,
    });
  }

  async function createAuthenticatedMultipartRequest(options: { file?: File } = {}) {
    const token = await createSessionToken({
      userId,
      teamId,
      email: "avatar-photo@example.com",
      name: "Avatar Photo User",
    });

    return createMultipartRequest({
      file: options.file,
      cookie: `session=${token}`,
    });
  }
});

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}
