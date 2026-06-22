import { NextRequest, NextResponse } from "next/server";
import { AssetType, LicenseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import { writeAuditLog } from "@/lib/audit-log";
import {
  parseImageMetadata,
  validateAvatarPhotoUpload,
} from "@/lib/avatar/photo";
import {
  AVATAR_PHOTO_CHECK_API_MESSAGES,
  AVATAR_PHOTO_ERROR_CODES,
  AVATAR_PHOTO_ERROR_MESSAGES,
} from "@/lib/avatar/constants";
import { detectAvatarPhotoContent } from "@/lib/avatar/detector";
import { analyzeAvatarPhotoQuality } from "@/lib/avatar/quality";
import {
  deleteAsset,
  ensureBucketExists,
  getMinioDiagnostics,
  uploadAsset,
} from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;

    if (!file) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: AVATAR_PHOTO_CHECK_API_MESSAGES.missingFile,
          errorCode: "EMPTY_FILE",
        },
        { status: 400 }
      );
    }

    const validation = validateAvatarPhotoUpload(file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: validation.errorMessage,
          errorCode: validation.errorCode,
        },
        { status: 400 }
      );
    }

    const assetId = crypto.randomUUID();
    const fileName = file.name || `${assetId}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let photoMetadata;
    try {
      photoMetadata = parseImageMetadata(buffer, file.type, file.size);
    } catch {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: AVATAR_PHOTO_ERROR_MESSAGES[AVATAR_PHOTO_ERROR_CODES.metadataInvalid],
          errorCode: AVATAR_PHOTO_ERROR_CODES.metadataInvalid,
        },
        { status: 400 }
      );
    }

    const detection = await detectAvatarPhotoContent({
      buffer,
      fileName,
      metadata: photoMetadata,
    });
    const qualityReport = analyzeAvatarPhotoQuality(photoMetadata, detection);

    try {
      await ensureBucketExists();
    } catch (error) {
      console.error("Bucket initialization error:", getMinioDiagnostics(error));
      return NextResponse.json(
        {
          code: "STORAGE_ERROR",
          message: AVATAR_PHOTO_CHECK_API_MESSAGES.storageInitFailed,
        },
        { status: 500 }
      );
    }

    let storageUrl: string;
    try {
      storageUrl = await uploadAsset(
        session.teamId,
        assetId,
        fileName,
        buffer,
        file.type,
        file.size
      );
    } catch (error) {
      console.error("Avatar source upload error:", getMinioDiagnostics(error));
      return NextResponse.json(
        {
          code: "STORAGE_ERROR",
          message: AVATAR_PHOTO_CHECK_API_MESSAGES.uploadFailed,
        },
        { status: 500 }
      );
    }

    try {
      const asset = await prisma.$transaction(async (tx) => {
        const createdAsset = await tx.asset.create({
          data: {
            id: assetId,
            teamId: session.teamId,
            ownerId: session.userId,
            type: AssetType.avatar_source,
            name: name?.trim() || file.name || assetId,
            storageUrl,
            mimeType: file.type,
            sizeBytes: BigInt(file.size),
            metadata: {
              photoMetadata,
              qualityReport,
            },
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
          createdAsset.id,
          {
            name: createdAsset.name,
            type: createdAsset.type,
            storageUrl: createdAsset.storageUrl,
            mimeType: createdAsset.mimeType,
            qualityPassed: qualityReport.passed,
          },
          {
            teamId: session.teamId,
            userId: session.userId,
          },
          tx
        );

        return createdAsset;
      });

      const responseAsset = await serializeAsset(asset, {
        onAccessUrlError: (error) => {
          console.error("Failed to generate avatar source URL:", error);
        },
      });

      return success(
        {
          asset: responseAsset,
          qualityReport,
        },
        AVATAR_PHOTO_CHECK_API_MESSAGES.success
      );
    } catch (error) {
      console.error("Avatar source database write error:", error);

      try {
        await deleteAsset(session.teamId, assetId, fileName);
      } catch (cleanupError) {
        console.error("Avatar source cleanup error:", cleanupError);
      }

      return NextResponse.json(
        {
          code: "DATABASE_ERROR",
          message: AVATAR_PHOTO_CHECK_API_MESSAGES.databaseWriteFailed,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Avatar photo-check error:", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: AVATAR_PHOTO_CHECK_API_MESSAGES.internalError,
      },
      { status: 500 }
    );
  }
}
