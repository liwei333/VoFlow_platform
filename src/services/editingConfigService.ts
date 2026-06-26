import { Prisma } from "@prisma/client";
import {
  ASSET_LICENSE_ERROR_CODES,
  AssetLicenseError,
  assertAssetUsable,
} from "@/lib/assets/consent";
import { prisma } from "@/lib/db";
import {
  DEFAULT_EDITING_CONFIG,
  EDITING_ERROR_CODES,
  EDITING_ERROR_MESSAGES,
} from "@/lib/editing/constants";
import { buildKeywordHighlightConfig } from "@/lib/editing/keyword-highlight";
import {
  serializeDefaultEditingConfig,
  serializeEditingConfig,
  type SerializedEditingConfig,
} from "@/lib/editing/serializer";
import type { SaveEditingConfigInput } from "@/lib/editing/validation";

export type GetEditingConfigForJobInput = {
  jobId: string;
  teamId: string;
};

export type GetEditingConfigForJobResult =
  | {
      success: true;
      data: {
        config: SerializedEditingConfig;
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof EDITING_ERROR_CODES.jobNotFound
          | typeof EDITING_ERROR_CODES.configQueryFailed;
        message: string;
      };
    };

export type SaveEditingConfigForJobInput = SaveEditingConfigInput & {
  jobId: string;
  teamId: string;
};

export type SaveEditingConfigForJobResult =
  | {
      success: true;
      data: {
        config: SerializedEditingConfig;
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof EDITING_ERROR_CODES.jobNotFound
          | typeof EDITING_ERROR_CODES.configSaveFailed
          | typeof EDITING_ERROR_CODES.pipAssetLicenseNotApproved
          | typeof EDITING_ERROR_CODES.pipAssetTypeUnsupported
          | typeof EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved
          | typeof EDITING_ERROR_CODES.backgroundAssetTypeUnsupported;
        message: string;
      };
    };

export async function getEditingConfigForJob(
  input: GetEditingConfigForJobInput
): Promise<GetEditingConfigForJobResult> {
  try {
    const job = await prisma.videoJob.findFirst({
      where: {
        id: input.jobId,
        teamId: input.teamId,
      },
      select: {
        id: true,
        editingConfig: {
          include: {
            previewArtifact: {
              select: {
                id: true,
                type: true,
                storageUrl: true,
                metadata: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      return getEditingConfigError(EDITING_ERROR_CODES.jobNotFound);
    }

    return {
      success: true,
      data: {
        config: job.editingConfig
          ? serializeEditingConfig(job.editingConfig)
          : serializeDefaultEditingConfig(job.id),
      },
    };
  } catch {
    return getEditingConfigError(EDITING_ERROR_CODES.configQueryFailed);
  }
}

export async function saveEditingConfigForJob(
  input: SaveEditingConfigForJobInput
): Promise<SaveEditingConfigForJobResult> {
  try {
    const job = await prisma.videoJob.findFirst({
      where: {
        id: input.jobId,
        teamId: input.teamId,
      },
      select: {
        id: true,
        editingConfig: true,
      },
    });

    if (!job) {
      return saveEditingConfigError(EDITING_ERROR_CODES.jobNotFound);
    }

    const existing = job.editingConfig;
    const rawConfigJson =
      input.configJson !== undefined
        ? input.configJson
        : existing?.configJson ?? DEFAULT_EDITING_CONFIG.configJson;
    const data = {
      subtitleEnabled:
        input.subtitleEnabled ??
        existing?.subtitleEnabled ??
        DEFAULT_EDITING_CONFIG.subtitleEnabled,
      keywordHighlightEnabled:
        input.keywordHighlightEnabled ??
        existing?.keywordHighlightEnabled ??
        DEFAULT_EDITING_CONFIG.keywordHighlightEnabled,
      bgmDuckingEnabled:
        input.bgmDuckingEnabled ??
        existing?.bgmDuckingEnabled ??
        DEFAULT_EDITING_CONFIG.bgmDuckingEnabled,
      pipEnabled:
        input.pipEnabled ?? existing?.pipEnabled ?? DEFAULT_EDITING_CONFIG.pipEnabled,
      pipAssetId:
        input.pipAssetId !== undefined
          ? input.pipAssetId
          : existing?.pipAssetId ?? DEFAULT_EDITING_CONFIG.pipAssetId,
      pipPosition:
        input.pipPosition ??
        existing?.pipPosition ??
        DEFAULT_EDITING_CONFIG.pipPosition,
      pipSize: input.pipSize ?? existing?.pipSize ?? DEFAULT_EDITING_CONFIG.pipSize,
      backgroundAssetId:
        input.backgroundAssetId !== undefined
          ? input.backgroundAssetId
          : existing?.backgroundAssetId ?? DEFAULT_EDITING_CONFIG.backgroundAssetId,
      voiceVolume:
        input.voiceVolume ?? existing?.voiceVolume ?? DEFAULT_EDITING_CONFIG.voiceVolume,
      bgmVolume:
        input.bgmVolume ?? existing?.bgmVolume ?? DEFAULT_EDITING_CONFIG.bgmVolume,
      transitionStrength:
        input.transitionStrength ??
        existing?.transitionStrength ??
        DEFAULT_EDITING_CONFIG.transitionStrength,
      configJson: await buildConfigJsonForSave({
        jobId: job.id,
        teamId: input.teamId,
        keywordHighlightEnabled:
          input.keywordHighlightEnabled ??
          existing?.keywordHighlightEnabled ??
          DEFAULT_EDITING_CONFIG.keywordHighlightEnabled,
        configJson: rawConfigJson,
      }),
    };

    const pipValidationError = await validateEditingAssetForSave({
      assetRequired: data.pipEnabled,
      assetId: data.pipAssetId,
      teamId: input.teamId,
      licenseErrorCode: EDITING_ERROR_CODES.pipAssetLicenseNotApproved,
      typeErrorCode: EDITING_ERROR_CODES.pipAssetTypeUnsupported,
    });
    if (pipValidationError) {
      return saveEditingConfigError(pipValidationError);
    }

    const backgroundValidationError = await validateEditingAssetForSave({
      assetRequired: false,
      assetId: data.backgroundAssetId,
      teamId: input.teamId,
      licenseErrorCode: EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved,
      typeErrorCode: EDITING_ERROR_CODES.backgroundAssetTypeUnsupported,
    });
    if (backgroundValidationError) {
      return saveEditingConfigError(backgroundValidationError);
    }

    const config = await prisma.editingConfig.upsert({
      where: {
        jobId: job.id,
      },
      create: {
        jobId: job.id,
        ...data,
      },
      update: data,
      include: {
        previewArtifact: {
          select: {
            id: true,
            type: true,
            storageUrl: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        config: serializeEditingConfig(config),
      },
    };
  } catch {
    return saveEditingConfigError(EDITING_ERROR_CODES.configSaveFailed);
  }
}

async function validateEditingAssetForSave(input: {
  assetRequired: boolean;
  assetId: string | null;
  teamId: string;
  licenseErrorCode:
    | typeof EDITING_ERROR_CODES.pipAssetLicenseNotApproved
    | typeof EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved;
  typeErrorCode:
    | typeof EDITING_ERROR_CODES.pipAssetTypeUnsupported
    | typeof EDITING_ERROR_CODES.backgroundAssetTypeUnsupported;
}): Promise<
  | typeof EDITING_ERROR_CODES.pipAssetLicenseNotApproved
  | typeof EDITING_ERROR_CODES.pipAssetTypeUnsupported
  | typeof EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved
  | typeof EDITING_ERROR_CODES.backgroundAssetTypeUnsupported
  | null
> {
  if (!input.assetRequired && !input.assetId) {
    return null;
  }

  if (!input.assetId) {
    return input.licenseErrorCode;
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
    },
  });

  if (!asset) {
    return input.licenseErrorCode;
  }

  if (asset.type !== "image" && asset.type !== "video") {
    return input.typeErrorCode;
  }

  try {
    await assertAssetUsable(asset.id, "video_generation");
  } catch (error) {
    if (
      error instanceof AssetLicenseError &&
      (error.code === ASSET_LICENSE_ERROR_CODES.notApproved ||
        error.code === ASSET_LICENSE_ERROR_CODES.notFound ||
        error.code === ASSET_LICENSE_ERROR_CODES.scopeNotAllowed)
    ) {
      return input.licenseErrorCode;
    }

    throw error;
  }

  return null;
}

async function buildConfigJsonForSave(input: {
  jobId: string;
  teamId: string;
  keywordHighlightEnabled: boolean;
  configJson: SaveEditingConfigInput["configJson"] | Prisma.JsonValue | null;
}): Promise<Prisma.InputJsonValue | typeof Prisma.JsonNull> {
  const script = await prisma.script.findFirst({
    where: {
      jobId: input.jobId,
      status: "approved",
      project: {
        teamId: input.teamId,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      content: true,
    },
  });

  const keywordHighlight = buildKeywordHighlightConfig({
    enabled: input.keywordHighlightEnabled,
    scriptContent: script?.content ?? "",
  });
  const baseConfig = isPlainJsonObject(input.configJson) ? input.configJson : {};

  return toNullableJsonInput({
    ...baseConfig,
    keywordHighlight,
  });
}

function toNullableJsonInput(
  value: SaveEditingConfigInput["configJson"] | Prisma.JsonValue | null
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getEditingConfigError(
  code:
    | typeof EDITING_ERROR_CODES.jobNotFound
    | typeof EDITING_ERROR_CODES.configQueryFailed
): Extract<GetEditingConfigForJobResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: EDITING_ERROR_MESSAGES[code],
    },
  };
}

function saveEditingConfigError(
  code:
    | typeof EDITING_ERROR_CODES.jobNotFound
    | typeof EDITING_ERROR_CODES.configSaveFailed
    | typeof EDITING_ERROR_CODES.pipAssetLicenseNotApproved
    | typeof EDITING_ERROR_CODES.pipAssetTypeUnsupported
    | typeof EDITING_ERROR_CODES.backgroundAssetLicenseNotApproved
    | typeof EDITING_ERROR_CODES.backgroundAssetTypeUnsupported
): Extract<SaveEditingConfigForJobResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: EDITING_ERROR_MESSAGES[code],
    },
  };
}
