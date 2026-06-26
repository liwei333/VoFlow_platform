import { describe, expect, it, vi } from "vitest";
import {
  ASSET_LICENSE_ERROR_CODES,
  AssetLicenseError,
} from "@/lib/assets/consent";
import { resolveExportBgmAsset } from "@/services/exportBgmService";

describe("export BGM authorization", () => {
  it("allows export without BGM by default", async () => {
    const findAsset = vi.fn();
    const assertAssetUsable = vi.fn();

    await expect(
      resolveExportBgmAsset(
        { teamId: "team-1", bgmAssetId: null },
        { findAsset, assertAssetUsable }
      )
    ).resolves.toEqual({
      success: true,
      data: {
        bgmAsset: null,
      },
    });

    expect(findAsset).not.toHaveBeenCalled();
    expect(assertAssetUsable).not.toHaveBeenCalled();
  });

  it("accepts an approved BGM asset for video generation", async () => {
    const findAsset = vi.fn().mockResolvedValue({
      id: "bgm-1",
      teamId: "team-1",
      type: "bgm",
      storageUrl: "voflow/team/assets/bgm-1/raw/bgm.mp3",
      mimeType: "audio/mpeg",
      name: "BGM",
    });
    const assertAssetUsable = vi.fn().mockResolvedValue({
      assetId: "bgm-1",
      teamId: "team-1",
      licenseStatus: "approved",
      usageScope: "video_generation",
    });

    await expect(
      resolveExportBgmAsset(
        { teamId: "team-1", bgmAssetId: "bgm-1" },
        { findAsset, assertAssetUsable }
      )
    ).resolves.toMatchObject({
      success: true,
      data: {
        bgmAsset: {
          id: "bgm-1",
          type: "bgm",
        },
      },
    });
    expect(findAsset).toHaveBeenCalledWith({
      teamId: "team-1",
      assetId: "bgm-1",
    });
    expect(assertAssetUsable).toHaveBeenCalledWith("bgm-1", "video_generation");
  });

  it("rejects unapproved BGM assets with a stable export error", async () => {
    const result = await resolveExportBgmAsset(
      { teamId: "team-1", bgmAssetId: "bgm-pending" },
      {
        findAsset: vi.fn().mockResolvedValue({
          id: "bgm-pending",
          teamId: "team-1",
          type: "audio",
          storageUrl: "voflow/team/assets/bgm-pending/raw/bgm.mp3",
          mimeType: "audio/mpeg",
          name: "Pending BGM",
        }),
        assertAssetUsable: vi.fn().mockRejectedValue(
          new AssetLicenseError(
            ASSET_LICENSE_ERROR_CODES.notApproved,
            "bgm-pending",
            "video_generation"
          )
        ),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "BGM_LICENSE_NOT_APPROVED",
        message: "BGM 素材未授权",
      },
    });
  });

  it("rejects non-audio BGM assets", async () => {
    const result = await resolveExportBgmAsset(
      { teamId: "team-1", bgmAssetId: "image-1" },
      {
        findAsset: vi.fn().mockResolvedValue({
          id: "image-1",
          teamId: "team-1",
          type: "image",
          storageUrl: "voflow/team/assets/image-1/raw/image.png",
          mimeType: "image/png",
          name: "Image",
        }),
        assertAssetUsable: vi.fn(),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "BGM_ASSET_TYPE_UNSUPPORTED",
        message: "BGM 素材仅支持音频",
      },
    });
  });
});
