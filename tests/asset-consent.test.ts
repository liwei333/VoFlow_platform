import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ASSET_LICENSE_ERROR_CODES,
  assertAssetUsable,
} from "@/lib/assets/consent";

describe("Asset consent service", () => {
  let teamId: string;
  let userId: string;
  const createdAssetIds: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { email: "dev@voflow.local" },
      include: { teamMemberships: true },
    });

    if (!user?.teamMemberships[0]?.teamId) {
      throw new Error("dev user seed data is required for asset consent tests");
    }

    userId = user.id;
    teamId = user.teamMemberships[0].teamId;
  });

  afterAll(async () => {
    await prisma.asset.deleteMany({
      where: {
        id: { in: createdAssetIds },
      },
    });
  });

  async function createAsset(options: {
    licenseStatus: LicenseStatus;
    deletedAt?: Date;
    usageScope?: string[];
    metadata?: Record<string, unknown>;
  }) {
    const assetId = `test-assert-${crypto.randomUUID()}`;
    createdAssetIds.push(assetId);

    await prisma.asset.create({
      data: {
        id: assetId,
        teamId,
        ownerId: userId,
        type: "image",
        name: `Assert Asset ${assetId}`,
        storageUrl: `voflow/${teamId}/assets/${assetId}/raw/test.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: BigInt(1000),
        metadata: options.metadata,
        licenseStatus: options.licenseStatus,
        deletedAt: options.deletedAt,
      },
    });

    if (options.usageScope) {
      await prisma.assetConsent.create({
        data: {
          assetId,
          teamId,
          userId,
          consentType: "asset_license",
          consentText: "test consent",
          usageScope: options.usageScope,
        },
      });
    }

    return assetId;
  }

  it("returns asset and consent when approved for the requested usage scope", async () => {
    const assetId = await createAsset({
      licenseStatus: "approved",
      usageScope: ["video_generation", "publishing"],
    });

    const result = await assertAssetUsable(assetId, "video_generation");

    expect(result).toEqual({
      assetId,
      teamId,
      licenseStatus: "approved",
      usageScope: "video_generation",
    });
  });

  it("rejects pending assets", async () => {
    const assetId = await createAsset({
      licenseStatus: "pending",
      usageScope: ["video_generation"],
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.notApproved,
      assetId,
    });
  });

  it("rejects rejected assets", async () => {
    const assetId = await createAsset({
      licenseStatus: "rejected",
      usageScope: ["video_generation"],
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.notApproved,
      assetId,
    });
  });

  it("rejects expired assets", async () => {
    const assetId = await createAsset({
      licenseStatus: "expired",
      usageScope: ["video_generation"],
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.notApproved,
      assetId,
    });
  });

  it("rejects approved assets without the requested usage scope", async () => {
    const assetId = await createAsset({
      licenseStatus: "approved",
      usageScope: ["avatar_generation"],
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.notApproved,
      assetId,
      usageScope: "video_generation",
    });
  });

  it("rejects public URL imported assets outside reference analysis scope", async () => {
    const assetId = await createAsset({
      licenseStatus: "approved",
      usageScope: ["reference_analysis_only"],
      metadata: {
        sourceType: "reference_url_import",
        referenceSourceId: "reference-url-source-id",
        importMode: "audio_extract",
      },
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.scopeNotAllowed,
      assetId,
      usageScope: "video_generation",
    });
  });

  it("rejects soft-deleted assets as not found", async () => {
    const assetId = await createAsset({
      licenseStatus: "approved",
      deletedAt: new Date(),
      usageScope: ["video_generation"],
    });

    await expect(assertAssetUsable(assetId, "video_generation")).rejects.toMatchObject({
      code: ASSET_LICENSE_ERROR_CODES.notFound,
      assetId,
    });
  });
});
