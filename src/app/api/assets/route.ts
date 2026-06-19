import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success, validationError } from "@/lib/api-response";
import { serializeAssets } from "@/lib/assets/serializer";
import { AssetType, LicenseStatus, Prisma } from "@prisma/client";
import { z } from "zod";

const listAssetsQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional().default("1"),
  pageSize: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional().default("20"),
  type: z.nativeEnum(AssetType).optional(),
  licenseStatus: z.nativeEnum(LicenseStatus).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export async function GET(request: NextRequest) {
  // Step 1: Authentication
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;

  try {
    // Step 2: Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = listAssetsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const { page, pageSize, type, licenseStatus, sortBy, sortOrder } = parsed.data;

    // Step 3: Build where clause
    const where: Prisma.AssetWhereInput = {
      teamId: session.teamId,
      deletedAt: null,
    };

    if (type) {
      where.type = type;
    }

    if (licenseStatus) {
      where.licenseStatus = licenseStatus;
    }

    // Step 4: Calculate pagination
    const skip = (page - 1) * pageSize;

    // Step 5: Query assets
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: pageSize,
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
      }),
      prisma.asset.count({ where }),
    ]);

    // Step 6: Generate presigned URLs and format response
    const assetsWithUrls = await serializeAssets(assets, {
      onAccessUrlError: (error) => {
        console.error("Failed to generate presigned URL:", error);
      },
    });

    // Step 7: Return paginated response
    return success({
      assets: assetsWithUrls,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("List assets error:", error);
    return internalError();
  }
}
