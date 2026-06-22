import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

const detectAvatarPhotoContentMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/lib/avatar/detector", async () => {
  const actual = await vi.importActual<typeof import("@/lib/avatar/detector")>("@/lib/avatar/detector");
  return {
    ...actual,
    detectAvatarPhotoContent: detectAvatarPhotoContentMock,
  };
});

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

    detectAvatarPhotoContentMock.mockResolvedValue(undefined);
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

  it("uploads an avatar_source asset and reports unavailable content detection", async () => {
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
          passed: false,
          faceCount: 1,
          resolution: {
            width: 1080,
            height: 1440,
          },
          reasons: [
            {
              code: "AVATAR_PHOTO_DETECTOR_UNAVAILABLE",
              message: "照片内容检测服务未接入，暂不能确认人脸、清晰度、遮挡和曝光",
            },
          ],
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
        passed: false,
        faceCount: 1,
      },
    });
  });

  it("uses detector output to pass a qualified avatar photo", async () => {
    detectAvatarPhotoContentMock.mockResolvedValueOnce({
      faceCount: 1,
      faceBoxRatio: 0.48,
      confidence: 0.99,
      yaw: 1,
      pitch: 2,
      roll: 3,
      blurScore: 180,
      occlusion: "none",
      exposure: "normal",
    });

    const response = await POST(await createAuthenticatedMultipartRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        qualityReport: {
          passed: true,
          faceCount: 1,
          faceBoxRatio: 0.48,
          confidence: 0.99,
          yaw: 1,
          pitch: 2,
          roll: 3,
          blurScore: 180,
          occlusion: "none",
          exposure: "normal",
          reasons: [],
        },
      },
    });

    expect(detectAvatarPhotoContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        buffer: expect.any(Buffer),
        fileName: "avatar.png",
        metadata: expect.objectContaining({
          width: 1080,
          height: 1440,
          resolutionPassed: true,
        }),
      })
    );
  });

  it("uses detector output to fail an unqualified avatar photo", async () => {
    detectAvatarPhotoContentMock.mockResolvedValueOnce({
      faceCount: 1,
      yaw: 0,
      pitch: 0,
      roll: 0,
      blurScore: 50,
      occlusion: "mask",
      exposure: "overexposed",
    });

    const response = await POST(await createAuthenticatedMultipartRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        qualityReport: {
          passed: false,
          faceCount: 1,
          yaw: 0,
          pitch: 0,
          roll: 0,
          blurScore: 50,
          occlusion: "mask",
          exposure: "overexposed",
          reasons: [
            {
              code: "AVATAR_PHOTO_BLURRY",
              message: "照片清晰度不足，请重新拍摄或上传更清晰的照片",
            },
            {
              code: "AVATAR_FACE_OCCLUDED",
              message: "检测到脸部遮挡，请移除口罩、墨镜或其他遮挡物",
            },
            {
              code: "AVATAR_PHOTO_EXPOSURE_INVALID",
              message: "照片曝光异常，请上传光线均匀的照片",
            },
          ],
        },
      },
    });
  });

  it("can use the mock detector for local demo photo checks", async () => {
    detectAvatarPhotoContentMock.mockImplementationOnce(async (input) => {
      const { mockAvatarPhotoDetector } = await vi.importActual<typeof import("@/lib/avatar/detector")>(
        "@/lib/avatar/detector"
      );
      return mockAvatarPhotoDetector.detect(input);
    });

    const response = await POST(await createAuthenticatedMultipartRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        qualityReport: {
          passed: true,
          faceCount: 1,
          reasons: [],
        },
      },
    });
  });

  it("returns explicit quality reasons for invalid avatar photos", async () => {
    const response = await POST(
      await createAuthenticatedMultipartRequest({
        file: new File([toArrayBuffer(pngBuffer(640, 960))], "low-resolution.png", { type: "image/png" }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      data: {
        qualityReport: {
          passed: false,
          reasons: [
            {
              code: "AVATAR_PHOTO_DETECTOR_UNAVAILABLE",
              message: "照片内容检测服务未接入，暂不能确认人脸、清晰度、遮挡和曝光",
            },
            {
              code: "AVATAR_PHOTO_RESOLUTION_TOO_LOW",
              message: "照片分辨率过低，请上传短边不低于 720px 的照片",
            },
          ],
        },
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
