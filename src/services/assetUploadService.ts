import { AssetType, LicenseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { validateAsset } from "@/lib/assets/validation";
import {
  deleteAsset,
  ensureBucketExists,
  getMinioDiagnostics,
  uploadAsset as uploadObject,
} from "@/lib/storage";

type UploadedAsset = {
  id: string;
  teamId: string;
  ownerId: string;
  type: AssetType;
  name: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: bigint;
  metadata: Prisma.JsonValue | null;
  licenseStatus: LicenseStatus;
  createdAt: Date;
  updatedAt: Date;
};

type UploadAssetFileInput<Related> = {
  teamId: string;
  userId: string;
  file: File;
  assetType: AssetType;
  name?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  auditMetadata?: Prisma.InputJsonValue;
  createRelated?: (
    tx: Prisma.TransactionClient,
    asset: UploadedAsset
  ) => Promise<Related>;
  logContext?: string;
};

type UploadAssetFileError = {
  code: "VALIDATION_ERROR" | "STORAGE_ERROR" | "DATABASE_ERROR";
  message: string;
  status: number;
  errorCode?: string;
};

export type UploadAssetFileResult<Related = undefined> =
  | {
      success: true;
      asset: UploadedAsset;
      related: Related;
    }
  | {
      success: false;
      error: UploadAssetFileError;
    };

export async function uploadAssetFile<Related = undefined>(
  input: UploadAssetFileInput<Related>
): Promise<UploadAssetFileResult<Related>> {
  const mimeType = input.file.type;
  const sizeBytes = input.file.size;
  const validation = validateAsset(mimeType, sizeBytes, input.assetType);

  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.errorMessage ?? "素材校验失败",
        errorCode: validation.errorCode,
        status: 400,
      },
    };
  }

  const assetId = crypto.randomUUID();
  const fileName = input.file.name || assetId;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const logPrefix = input.logContext ?? "Asset upload";

  try {
    await ensureBucketExists();
  } catch (error) {
    console.error(`${logPrefix} bucket initialization error:`, getMinioDiagnostics(error));
    return {
      success: false,
      error: {
        code: "STORAGE_ERROR",
        message: "存储初始化失败",
        status: 500,
      },
    };
  }

  let storageUrl: string;
  try {
    storageUrl = await uploadObject(
      input.teamId,
      assetId,
      fileName,
      buffer,
      mimeType,
      sizeBytes
    );
  } catch (error) {
    console.error(`${logPrefix} storage error:`, getMinioDiagnostics(error));
    return {
      success: false,
      error: {
        code: "STORAGE_ERROR",
        message: "文件上传失败",
        status: 500,
      },
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const asset = await tx.asset.create({
        data: {
          id: assetId,
          teamId: input.teamId,
          ownerId: input.userId,
          type: input.assetType,
          name: input.name?.trim() || input.file.name || assetId,
          storageUrl,
          mimeType,
          sizeBytes: BigInt(sizeBytes),
          metadata: input.metadata === null ? Prisma.JsonNull : input.metadata,
          licenseStatus: LicenseStatus.pending,
        },
        select: {
          id: true,
          teamId: true,
          ownerId: true,
          type: true,
          name: true,
          storageUrl: true,
          mimeType: true,
          sizeBytes: true,
          metadata: true,
          licenseStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await writeAuditLog(
        "asset_upload",
        "asset",
        asset.id,
        {
          name: asset.name,
          type: asset.type,
          storageUrl: asset.storageUrl,
          mimeType: asset.mimeType,
          ...(isRecord(input.auditMetadata) ? input.auditMetadata : {}),
        },
        {
          teamId: input.teamId,
          userId: input.userId,
        },
        tx
      );

      const related = input.createRelated
        ? await input.createRelated(tx, asset)
        : (undefined as Related);

      return { asset, related };
    });

    return {
      success: true,
      asset: result.asset,
      related: result.related,
    };
  } catch (error) {
    console.error(`${logPrefix} database write error:`, error);

    try {
      await deleteAsset(input.teamId, assetId, fileName);
    } catch (cleanupError) {
      console.error(`${logPrefix} cleanup error:`, cleanupError);
    }

    return {
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "数据库写入失败",
        status: 500,
      },
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
