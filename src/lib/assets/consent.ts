import { LicenseStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import { REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE } from "@/lib/references/url-import/config";

export const ASSET_USAGE_SCOPES = [
  "video_generation",
  "avatar_generation",
  "publishing",
  "reference_analysis_only",
] as const;

export const DEFAULT_ASSET_CONSENT_TYPE = "asset_license";

export const ASSET_LICENSE_ERROR_CODES = {
  notFound: "ASSET_NOT_FOUND",
  notApproved: "ASSET_LICENSE_NOT_APPROVED",
  scopeNotAllowed: "ASSET_USAGE_SCOPE_NOT_ALLOWED",
} as const;

export const assetConsentRequestSchema = z.object({
  consentType: z.string().trim().min(1).max(64).optional(),
  consentText: z.string().trim().min(1).max(10000),
  usageScope: z.array(z.enum(ASSET_USAGE_SCOPES)).min(1),
  deviceJson: z.record(z.unknown()).optional(),
});

export type AssetConsentRequest = z.infer<typeof assetConsentRequestSchema>;
export type AssetUsageScope = (typeof ASSET_USAGE_SCOPES)[number];

export class AssetLicenseError extends Error {
  constructor(
    public readonly code: (typeof ASSET_LICENSE_ERROR_CODES)[keyof typeof ASSET_LICENSE_ERROR_CODES],
    public readonly assetId: string,
    public readonly usageScope?: AssetUsageScope
  ) {
    super(code);
    this.name = "AssetLicenseError";
  }
}

type ConfirmAssetConsentInput = AssetConsentRequest & {
  assetId: string;
  teamId: string;
  userId: string;
  ipAddress?: string;
};

export type ConfirmedAssetConsent = {
  consent: {
    id: string;
    assetId: string;
    teamId: string;
    userId: string;
    consentType: string;
    consentText: string;
    usageScope: string[];
    ipAddress: string | null;
    deviceJson: Prisma.JsonValue | null;
    createdAt: Date;
  };
  asset: {
    id: string;
    licenseStatus: LicenseStatus;
  };
};

export async function confirmAssetConsent(
  input: ConfirmAssetConsentInput
): Promise<ConfirmedAssetConsent | null> {
  const consentType = input.consentType ?? DEFAULT_ASSET_CONSENT_TYPE;

  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({
      where: {
        id: input.assetId,
        teamId: input.teamId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!asset) {
      return null;
    }

    const consent = await tx.assetConsent.create({
      data: {
        assetId: input.assetId,
        teamId: input.teamId,
        userId: input.userId,
        consentType,
        consentText: input.consentText,
        usageScope: input.usageScope,
        ipAddress: input.ipAddress,
        device: input.deviceJson as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        assetId: true,
        teamId: true,
        userId: true,
        consentType: true,
        consentText: true,
        usageScope: true,
        ipAddress: true,
        device: true,
        createdAt: true,
      },
    });

    const updatedAsset = await tx.asset.update({
      where: {
        id: input.assetId,
      },
      data: {
        licenseStatus: "approved",
      },
      select: {
        id: true,
        licenseStatus: true,
      },
    });

    await writeAuditLog(
      "asset_consent",
      "asset",
      input.assetId,
      {
        consentId: consent.id,
        consentType: consent.consentType,
        usageScope: consent.usageScope,
      },
      {
        teamId: input.teamId,
        userId: input.userId,
      },
      tx
    );

    return {
      consent: {
        id: consent.id,
        assetId: consent.assetId,
        teamId: consent.teamId,
        userId: consent.userId,
        consentType: consent.consentType,
        consentText: consent.consentText,
        usageScope: consent.usageScope,
        ipAddress: consent.ipAddress,
        deviceJson: consent.device,
        createdAt: consent.createdAt,
      },
      asset: {
        id: updatedAsset.id,
        licenseStatus: updatedAsset.licenseStatus,
      },
    };
  });
}

export async function assertAssetUsable(
  assetId: string,
  usageScope: AssetUsageScope
): Promise<{
  assetId: string;
  teamId: string;
  licenseStatus: LicenseStatus;
  usageScope: AssetUsageScope;
}> {
  const asset = await prisma.asset.findFirst({
    where: {
      id: assetId,
      deletedAt: null,
    },
    select: {
      id: true,
      teamId: true,
      licenseStatus: true,
      metadata: true,
      consents: {
        where: {
          usageScope: {
            has: usageScope,
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!asset) {
    throw new AssetLicenseError(ASSET_LICENSE_ERROR_CODES.notFound, assetId, usageScope);
  }

  if (isReferenceUrlImportedAsset(asset.metadata) && usageScope !== REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE) {
    throw new AssetLicenseError(ASSET_LICENSE_ERROR_CODES.scopeNotAllowed, assetId, usageScope);
  }

  if (asset.licenseStatus !== "approved" || asset.consents.length === 0) {
    throw new AssetLicenseError(ASSET_LICENSE_ERROR_CODES.notApproved, assetId, usageScope);
  }

  return {
    assetId: asset.id,
    teamId: asset.teamId,
    licenseStatus: asset.licenseStatus,
    usageScope,
  };
}

function isReferenceUrlImportedAsset(metadata: Prisma.JsonValue): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  return (metadata as { sourceType?: unknown }).sourceType === "reference_url_import";
}
