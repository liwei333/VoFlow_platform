import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import { AssetType } from "@prisma/client";
import { z } from "zod";
import { uploadAssetFile } from "@/services/assetUploadService";

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

    let metadata = null;

    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch {
        // Invalid JSON, ignore metadata
      }
    }

    const result = await uploadAssetFile({
      teamId: session.teamId,
      userId: session.userId,
      file,
      assetType,
      name: nameStr,
      metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error.code,
          message: result.error.message,
          ...(result.error.errorCode ? { errorCode: result.error.errorCode } : {}),
        },
        { status: result.error.status }
      );
    }

    const responseAsset = await serializeAsset(result.asset, {
      onAccessUrlError: (error) => {
        console.error("Failed to generate presigned URL:", error);
      },
    });

    return success({ asset: responseAsset }, "素材上传成功");
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
