import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import { validateAsset } from "@/lib/assets/validation";
import { uploadAsset, deleteAsset, ensureBucketExists, getMinioDiagnostics } from "@/lib/storage";
import { writeAuditLog } from "@/lib/audit-log";
import { AssetType } from "@prisma/client";
import { z } from "zod";

export async function POST(request: NextRequest) {
  // Step 1: Authentication
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    // Step 2: Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const typeStr = formData.get("type") as string | null;
    const nameStr = formData.get("name") as string | null;
    const metadataStr = formData.get("metadata") as string | null;

    // Step 3: Validate required fields
    if (!file) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "缺少文件",
          errorCode: "EMPTY_FILE"
        },
        { status: 400 }
      );
    }

    if (!typeStr) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "缺少素材类型",
          errorCode: "INVALID_ASSET_TYPE"
        },
        { status: 400 }
      );
    }

    // Step 4: Validate asset type
    let assetType: AssetType;
    try {
      assetType = z.nativeEnum(AssetType).parse(typeStr);
    } catch {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: `无效的素材类型: ${typeStr}`,
          errorCode: "INVALID_ASSET_TYPE"
        },
        { status: 400 }
      );
    }

    // Step 5: Validate file
    const mimeType = file.type;
    const sizeBytes = file.size;
    const validation = validateAsset(mimeType, sizeBytes, assetType);

    if (!validation.valid) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: validation.errorMessage,
          errorCode: validation.errorCode
        },
        { status: 400 }
      );
    }

    // Step 6: Generate asset ID
    const assetId = crypto.randomUUID();

    // Step 7: Prepare file for upload
    const fileName = file.name || `${assetId}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Step 8: Ensure bucket exists
    try {
      await ensureBucketExists();
    } catch (error) {
      console.error("Bucket initialization error:", getMinioDiagnostics(error));
      return NextResponse.json(
        {
          code: "STORAGE_ERROR",
          message: "存储初始化失败"
        },
        { status: 500 }
      );
    }

    // Step 9: Upload to MinIO
    let storageUrl: string;
    try {
      storageUrl = await uploadAsset(
        session.teamId,
        assetId,
        fileName,
        buffer,
        mimeType,
        sizeBytes
      );
    } catch (error) {
      console.error("MinIO upload error:", getMinioDiagnostics(error));
      return NextResponse.json(
        {
          code: "STORAGE_ERROR",
          message: "文件上传失败"
        },
        { status: 500 }
      );
    }

    // Step 10: Write to database
    try {
      const assetName = nameStr || file.name || assetId;
      let metadata = null;

      if (metadataStr) {
        try {
          metadata = JSON.parse(metadataStr);
        } catch {
          // Invalid JSON, ignore metadata
        }
      }

      const asset = await prisma.$transaction(async (tx) => {
        const createdAsset = await tx.asset.create({
          data: {
            id: assetId,
            teamId: session.teamId,
            ownerId: session.userId,
            type: assetType,
            name: assetName,
            storageUrl,
            mimeType,
            sizeBytes: BigInt(sizeBytes),
            metadata,
            licenseStatus: "pending",
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
          console.error("Failed to generate presigned URL:", error);
        },
      });

      return success({ asset: responseAsset }, "素材上传成功");
    } catch (error) {
      // Step 10: Cleanup uploaded file if DB write fails
      console.error("Database write error:", error);

      try {
        await deleteAsset(session.teamId, assetId, fileName);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }

      return NextResponse.json(
        {
          code: "DATABASE_ERROR",
          message: "数据库写入失败"
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload asset error:", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "服务器内部错误"
      },
      { status: 500 }
    );
  }
}
