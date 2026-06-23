import {
  ASSET_LICENSE_ERROR_CODES,
  AssetLicenseError,
  assertAssetUsable,
  type AssetUsageScope,
} from "@/lib/assets/consent";
import { prisma } from "@/lib/db";
import {
  REFERENCE_MEDIA_DURATION_LIMIT_MS,
  getReferenceMediaDurationMs,
  isReferenceMediaAssetType,
  type ReferenceMediaAssetType,
} from "@/lib/references/assets";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";

export { REFERENCE_MEDIA_DURATION_LIMIT_MS } from "@/lib/references/assets";

const REFERENCE_EXTRACT_WORKFLOW_NODE_TYPE = WORKFLOW_NODE_DEFINITIONS.reference_extract
  .type as "reference_extract";

export const REFERENCE_ASSET_ERROR_CODES = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  ASSET_NOT_FOUND: "REFERENCE_ASSET_NOT_FOUND",
  UNSUPPORTED_ASSET_TYPE: "REFERENCE_UNSUPPORTED_ASSET_TYPE",
  ASSET_LICENSE_NOT_APPROVED: "ASSET_LICENSE_NOT_APPROVED",
  ASSET_USAGE_SCOPE_NOT_ALLOWED: "ASSET_USAGE_SCOPE_NOT_ALLOWED",
  DURATION_REQUIRED: "REFERENCE_DURATION_REQUIRED",
  DURATION_LIMIT_EXCEEDED: "REFERENCE_DURATION_LIMIT_EXCEEDED",
} as const;

export type ReferenceAssetErrorCode =
  (typeof REFERENCE_ASSET_ERROR_CODES)[keyof typeof REFERENCE_ASSET_ERROR_CODES];

export const REFERENCE_ASSET_ERROR_MESSAGES: Record<ReferenceAssetErrorCode, string> = {
  [REFERENCE_ASSET_ERROR_CODES.PROJECT_NOT_FOUND]: "项目不存在",
  [REFERENCE_ASSET_ERROR_CODES.ASSET_NOT_FOUND]: "素材不存在",
  [REFERENCE_ASSET_ERROR_CODES.UNSUPPORTED_ASSET_TYPE]: "仅支持音频或视频素材提取爆款参考。",
  [REFERENCE_ASSET_ERROR_CODES.ASSET_LICENSE_NOT_APPROVED]: "素材授权未确认，无法用于爆款提取。",
  [REFERENCE_ASSET_ERROR_CODES.ASSET_USAGE_SCOPE_NOT_ALLOWED]:
    "公开链接导入素材仅允许参考分析，不能用于视频生成、数字人、声音克隆或发布。",
  [REFERENCE_ASSET_ERROR_CODES.DURATION_REQUIRED]: "素材缺少音视频时长，无法提取爆款参考。",
  [REFERENCE_ASSET_ERROR_CODES.DURATION_LIMIT_EXCEEDED]: "音视频时长超过 3 分钟，无法提取爆款参考。",
};

export interface PrepareReferenceAssetExtractionInput {
  projectId: string;
  teamId: string;
  assetId: string;
  usageScope?: AssetUsageScope;
}

export type PrepareReferenceAssetExtractionResult =
  | {
      success: true;
      data: {
        referenceSource: {
          projectId: string;
          teamId: string;
          sourceType: "asset";
          assetId: string;
          durationMs: number;
        };
        workflowNode: {
          nodeType: "reference_extract";
          input: {
            sourceType: "asset";
            projectId: string;
            teamId: string;
            assetId: string;
            assetType: ReferenceMediaAssetType;
            storageUrl: string;
            durationMs: number;
            usageScope: AssetUsageScope;
          };
        };
      };
    }
  | {
      success: false;
      error: {
        code: ReferenceAssetErrorCode;
        message: string;
      };
    };

export async function prepareReferenceAssetExtraction(
  input: PrepareReferenceAssetExtractionInput
): Promise<PrepareReferenceAssetExtractionResult> {
  const usageScope = input.usageScope ?? "video_generation";

  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.PROJECT_NOT_FOUND);
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: input.assetId,
      teamId: input.teamId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      storageUrl: true,
      metadata: true,
    },
  });

  if (!asset) {
    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.ASSET_NOT_FOUND);
  }

  if (!isReferenceMediaAssetType(asset.type)) {
    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.UNSUPPORTED_ASSET_TYPE);
  }

  try {
    await assertAssetUsable(asset.id, usageScope);
  } catch (error) {
    if (
      error instanceof AssetLicenseError &&
      error.code === ASSET_LICENSE_ERROR_CODES.notApproved
    ) {
      return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.ASSET_LICENSE_NOT_APPROVED);
    }

    if (
      error instanceof AssetLicenseError &&
      error.code === ASSET_LICENSE_ERROR_CODES.scopeNotAllowed
    ) {
      return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.ASSET_USAGE_SCOPE_NOT_ALLOWED);
    }

    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.ASSET_NOT_FOUND);
  }

  const durationMs = getReferenceMediaDurationMs(asset.metadata);
  if (durationMs === null) {
    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.DURATION_REQUIRED);
  }

  if (durationMs > REFERENCE_MEDIA_DURATION_LIMIT_MS) {
    return referenceAssetError(REFERENCE_ASSET_ERROR_CODES.DURATION_LIMIT_EXCEEDED);
  }

  return {
    success: true,
    data: {
      referenceSource: {
        projectId: input.projectId,
        teamId: input.teamId,
        sourceType: "asset",
        assetId: asset.id,
        durationMs,
      },
      workflowNode: {
        nodeType: REFERENCE_EXTRACT_WORKFLOW_NODE_TYPE,
        input: {
          sourceType: "asset",
          projectId: input.projectId,
          teamId: input.teamId,
          assetId: asset.id,
          assetType: asset.type,
          storageUrl: asset.storageUrl,
          durationMs,
          usageScope,
        },
      },
    },
  };
}

function referenceAssetError(
  code: ReferenceAssetErrorCode
): Extract<PrepareReferenceAssetExtractionResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: REFERENCE_ASSET_ERROR_MESSAGES[code],
    },
  };
}
