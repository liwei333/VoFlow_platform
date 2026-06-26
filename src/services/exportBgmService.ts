import type { AssetType, LicenseStatus } from "@prisma/client";
import {
  type AssetUsageScope,
  assertAssetUsable,
  AssetLicenseError,
  ASSET_LICENSE_ERROR_CODES,
} from "@/lib/assets/consent";
import { prisma } from "@/lib/db";
import {
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
} from "@/lib/export/constants";

export const EXPORT_BGM_USAGE_SCOPE: AssetUsageScope = "video_generation";

const SUPPORTED_EXPORT_BGM_ASSET_TYPES: readonly AssetType[] = [
  "audio",
  "bgm",
];

export interface ResolveExportBgmAssetInput {
  teamId: string;
  bgmAssetId?: string | null;
}

export interface ExportBgmAssetRecord {
  id: string;
  teamId: string;
  type: AssetType;
  storageUrl: string;
  mimeType: string;
  name: string;
}

export interface ResolveExportBgmAssetDependencies {
  findAsset(input: {
    teamId: string;
    assetId: string;
  }): Promise<ExportBgmAssetRecord | null>;
  assertAssetUsable(
    assetId: string,
    usageScope: AssetUsageScope
  ): Promise<{
    assetId: string;
    teamId: string;
    licenseStatus: LicenseStatus;
    usageScope: AssetUsageScope;
  }>;
}

export type ResolveExportBgmAssetResult =
  | {
      success: true;
      data: {
        bgmAsset: ExportBgmAssetRecord | null;
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof EXPORT_ERROR_CODES.bgmAssetNotFound
          | typeof EXPORT_ERROR_CODES.bgmAssetTypeUnsupported
          | typeof EXPORT_ERROR_CODES.bgmLicenseNotApproved;
        message: string;
      };
    };

const defaultResolveExportBgmAssetDependencies: ResolveExportBgmAssetDependencies = {
  async findAsset(input) {
    return prisma.asset.findFirst({
      where: {
        id: input.assetId,
        teamId: input.teamId,
        deletedAt: null,
      },
      select: {
        id: true,
        teamId: true,
        type: true,
        storageUrl: true,
        mimeType: true,
        name: true,
      },
    });
  },
  assertAssetUsable,
};

export async function resolveExportBgmAsset(
  input: ResolveExportBgmAssetInput,
  dependencies: Partial<ResolveExportBgmAssetDependencies> = {}
): Promise<ResolveExportBgmAssetResult> {
  const { findAsset, assertAssetUsable: assertUsable } = {
    ...defaultResolveExportBgmAssetDependencies,
    ...dependencies,
  };

  if (!input.bgmAssetId) {
    return {
      success: true,
      data: {
        bgmAsset: null,
      },
    };
  }

  const asset = await findAsset({
    teamId: input.teamId,
    assetId: input.bgmAssetId,
  });

  if (!asset) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.bgmAssetNotFound,
        message: EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.bgmAssetNotFound],
      },
    };
  }

  if (!SUPPORTED_EXPORT_BGM_ASSET_TYPES.includes(asset.type)) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.bgmAssetTypeUnsupported,
        message:
          EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.bgmAssetTypeUnsupported],
      },
    };
  }

  try {
    await assertUsable(asset.id, EXPORT_BGM_USAGE_SCOPE);
  } catch (error) {
    if (
      error instanceof AssetLicenseError &&
      error.code === ASSET_LICENSE_ERROR_CODES.notFound
    ) {
      return {
        success: false,
        error: {
          code: EXPORT_ERROR_CODES.bgmAssetNotFound,
          message: EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.bgmAssetNotFound],
        },
      };
    }

    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.bgmLicenseNotApproved,
        message:
          EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.bgmLicenseNotApproved],
      },
    };
  }

  return {
    success: true,
    data: {
      bgmAsset: asset,
    },
  };
}
