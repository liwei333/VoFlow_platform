import { describe, expect, it } from "vitest";
import { AssetType, LicenseStatus } from "@prisma/client";
import {
  ASSET_ACCESS_URL_EXPIRES_SECONDS,
  getAssetFileName,
  serializeAsset,
} from "@/lib/assets/serializer";

describe("Asset serializer", () => {
  const createdAt = new Date("2026-06-19T01:02:03.000Z");
  const updatedAt = new Date("2026-06-19T04:05:06.000Z");

  const asset = {
    id: "asset-1",
    teamId: "team-1",
    ownerId: "user-1",
    type: AssetType.image,
    name: "Cover",
    storageUrl: "voflow/team-1/assets/asset-1/raw/cover.jpg",
    mimeType: "image/jpeg",
    sizeBytes: BigInt(12345),
    metadata: { width: 1080 },
    licenseStatus: LicenseStatus.pending,
    createdAt,
    updatedAt,
  };

  it("extracts fileName from storageUrl", () => {
    expect(getAssetFileName(asset.storageUrl)).toBe("cover.jpg");
  });

  it("serializes BigInt, keeps Dates, and generates accessUrl with the shared expiry", async () => {
    const serialized = await serializeAsset(asset, {
      generateAccessUrl: async (teamId, assetId, fileName, expiresInSeconds) => {
        expect(teamId).toBe("team-1");
        expect(assetId).toBe("asset-1");
        expect(fileName).toBe("cover.jpg");
        expect(expiresInSeconds).toBe(ASSET_ACCESS_URL_EXPIRES_SECONDS);
        return `signed://${teamId}/${assetId}/${fileName}?expires=${expiresInSeconds}`;
      },
    });

    expect(serialized).toEqual({
      id: "asset-1",
      teamId: "team-1",
      ownerId: "user-1",
      type: "image",
      name: "Cover",
      storageUrl: "voflow/team-1/assets/asset-1/raw/cover.jpg",
      fileName: "cover.jpg",
      accessUrl: "signed://team-1/asset-1/cover.jpg?expires=3600",
      mimeType: "image/jpeg",
      sizeBytes: "12345",
      metadata: { width: 1080 },
      licenseStatus: "pending",
      createdAt,
      updatedAt,
    });
  });

  it("falls back to an empty accessUrl when URL signing fails", async () => {
    const serialized = await serializeAsset(asset, {
      generateAccessUrl: async () => {
        throw new Error("MinIO unavailable");
      },
      onAccessUrlError: () => undefined,
    });

    expect(serialized.accessUrl).toBe("");
  });
});
