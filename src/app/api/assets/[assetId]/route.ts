import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import { writeAuditLog } from "@/lib/audit-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  // Step 1: Authentication
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { assetId } = await params;

  try {
    // Step 2: Query asset
    const asset = await prisma.asset.findUnique({
      where: {
        id: assetId,
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
        deletedAt: true,
      },
    });

    // Step 3: Check if asset exists
    if (!asset) {
      return notFound();
    }

    // Step 4: Check team ownership (return 404 to avoid leaking cross-team resource existence)
    if (asset.teamId !== session.teamId) {
      return notFound();
    }

    // Step 5: Check if asset is deleted
    if (asset.deletedAt !== null) {
      return notFound();
    }

    // Step 6: Generate presigned URL
    const responseAsset = await serializeAsset(asset, {
      onAccessUrlError: (error) => {
        console.error("Failed to generate presigned URL:", error);
      },
    });

    // Step 7: Return asset details
    return success({ asset: responseAsset });
  } catch (error) {
    console.error("Get asset error:", error);
    return internalError();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  // Step 1: Authentication
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { assetId } = await params;

  try {
    // Step 2: Query asset
    const asset = await prisma.asset.findUnique({
      where: {
        id: assetId,
      },
      select: {
        id: true,
        teamId: true,
        deletedAt: true,
      },
    });

    // Step 3: Check if asset exists
    if (!asset) {
      return notFound();
    }

    // Step 4: Check team ownership (return 404 to avoid leaking cross-team resource existence)
    if (asset.teamId !== session.teamId) {
      return notFound();
    }

    // Step 5: Check if asset is already deleted
    if (asset.deletedAt !== null) {
      return notFound();
    }

    // Step 6: Soft delete the asset
    const deletedAsset = await prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.asset.update({
        where: {
          id: assetId,
        },
        data: {
          deletedAt: new Date(),
        },
        select: {
          deletedAt: true,
        },
      });

      await writeAuditLog(
        "asset_delete",
        "asset",
        assetId,
        {
          deletedAt: updatedAsset.deletedAt?.toISOString(),
        },
        {
          teamId: session.teamId,
          userId: session.userId,
        },
        tx
      );

      return updatedAsset;
    });

    // Step 7: Return success
    return success({
      deletedAt: deletedAsset.deletedAt?.toISOString(),
    });
  } catch (error) {
    console.error("Delete asset error:", error);
    return internalError();
  }
}
