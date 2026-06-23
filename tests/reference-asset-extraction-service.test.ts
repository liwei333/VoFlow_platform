import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  REFERENCE_ASSET_ERROR_CODES,
  REFERENCE_MEDIA_DURATION_LIMIT_MS,
  prepareReferenceAssetExtraction,
} from "@/services/referenceAssetService";

describe("prepareReferenceAssetExtraction", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  const createdAssetIds: string[] = [];

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_asset_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference Asset User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference Asset Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Reference Asset Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    projectId = (
      await prisma.project.create({
        data: {
          teamId,
          ownerId: userId,
          name: "Reference Asset Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;
  });

  afterEach(async () => {
    await prisma.assetConsent.deleteMany({
      where: {
        OR: [{ teamId }, { teamId: otherTeamId }],
      },
    });
    await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("rejects non audio/video assets", async () => {
    const asset = await createAsset({
      type: "image",
      metadata: { width: 1080 },
      licenseStatus: "approved",
      usageScope: ["video_generation"],
    });

    const result = await prepareReferenceAssetExtraction({
      projectId,
      teamId,
      assetId: asset.id,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: REFERENCE_ASSET_ERROR_CODES.UNSUPPORTED_ASSET_TYPE,
        message: "仅支持音频或视频素材提取爆款参考。",
      },
    });
  });

  it("rejects assets without approved video generation authorization", async () => {
    const asset = await createAsset({
      type: "audio",
      metadata: { durationMs: 60_000 },
      licenseStatus: "pending",
      usageScope: ["video_generation"],
    });

    const result = await prepareReferenceAssetExtraction({
      projectId,
      teamId,
      assetId: asset.id,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: REFERENCE_ASSET_ERROR_CODES.ASSET_LICENSE_NOT_APPROVED,
        message: "素材授权未确认，无法用于爆款提取。",
      },
    });
  });

  it("rejects media longer than the reference extraction duration limit", async () => {
    const asset = await createAsset({
      type: "video",
      metadata: { durationMs: REFERENCE_MEDIA_DURATION_LIMIT_MS + 1 },
      licenseStatus: "approved",
      usageScope: ["video_generation"],
    });

    const result = await prepareReferenceAssetExtraction({
      projectId,
      teamId,
      assetId: asset.id,
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: REFERENCE_ASSET_ERROR_CODES.DURATION_LIMIT_EXCEEDED,
        message: "音视频时长超过 3 分钟，无法提取爆款参考。",
      },
    });
  });

  it("returns a reference_extract node input for approved media assets", async () => {
    const asset = await createAsset({
      type: "audio",
      metadata: { durationSeconds: 91 },
      licenseStatus: "approved",
      usageScope: ["video_generation"],
    });

    const result = await prepareReferenceAssetExtraction({
      projectId,
      teamId,
      assetId: asset.id,
    });

    expect(result).toEqual({
      success: true,
      data: {
        referenceSource: {
          projectId,
          teamId,
          sourceType: "asset",
          assetId: asset.id,
          durationMs: 91_000,
        },
        workflowNode: {
          nodeType: "reference_extract",
          input: {
            sourceType: "asset",
            projectId,
            teamId,
            assetId: asset.id,
            assetType: "audio",
            storageUrl: "voflow/reference/assets/sample.wav",
            durationMs: 91_000,
            usageScope: "video_generation",
          },
        },
      },
    });
  });

  it("accepts reference-analysis-only authorization when requested", async () => {
    const asset = await createAsset({
      type: "audio",
      metadata: { durationMs: 42_000 },
      licenseStatus: "approved",
      usageScope: ["reference_analysis_only"],
    });

    const result = await prepareReferenceAssetExtraction({
      projectId,
      teamId,
      assetId: asset.id,
      usageScope: "reference_analysis_only",
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        workflowNode: {
          input: {
            assetId: asset.id,
            assetType: "audio",
            durationMs: 42_000,
            usageScope: "reference_analysis_only",
          },
        },
      },
    });
  });

  async function createAsset(options: {
    type: "audio" | "video" | "image";
    metadata: Prisma.InputJsonObject;
    licenseStatus: "pending" | "approved";
    usageScope?: string[];
  }) {
    const asset = await prisma.asset.create({
      data: {
        teamId,
        ownerId: userId,
        type: options.type,
        name: `Reference ${options.type}`,
        storageUrl: `voflow/reference/assets/sample.${
          options.type === "audio" ? "wav" : options.type === "video" ? "mp4" : "png"
        }`,
        mimeType:
          options.type === "audio"
            ? "audio/wav"
            : options.type === "video"
              ? "video/mp4"
              : "image/png",
        sizeBytes: BigInt(1024),
        metadata: options.metadata,
        licenseStatus: options.licenseStatus,
      },
    });
    createdAssetIds.push(asset.id);

    if (options.usageScope) {
      await prisma.assetConsent.create({
        data: {
          assetId: asset.id,
          teamId,
          userId,
          consentType: "asset_license",
          consentText: "reference extraction consent",
          usageScope: options.usageScope,
        },
      });
    }

    return asset;
  }
});
