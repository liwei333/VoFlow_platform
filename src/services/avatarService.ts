import { AssetType, AvatarStatus, LicenseStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AVATAR_CONSENT_USAGE_SCOPES,
  AVATAR_ERROR_CODES,
  AVATAR_ERROR_MESSAGES,
  DEFAULT_AVATAR_CONSENT_TYPE,
} from "@/lib/avatar/constants";
import { serializeAvatar, serializeAvatars } from "@/lib/avatar/serializer";

const avatarConsentScopeSchema = z.enum(AVATAR_CONSENT_USAGE_SCOPES);

export const createAvatarRequestSchema = z.object({
  sourceAssetId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
  consentText: z.string().trim().max(10000).optional().default(""),
  usageScope: z.array(avatarConsentScopeSchema).optional().default([]),
  deviceJson: z.record(z.unknown()).optional(),
});

export const avatarConsentRequestSchema = z.object({
  consentText: z.string().trim().min(1).max(10000),
  usageScope: z.array(avatarConsentScopeSchema).min(2),
  deviceJson: z.record(z.unknown()).optional(),
});

export type CreateAvatarRequest = z.infer<typeof createAvatarRequestSchema>;
export type AvatarConsentRequest = z.infer<typeof avatarConsentRequestSchema>;

type AvatarServiceInput<T> = T & {
  teamId: string;
  userId: string;
  ipAddress?: string;
};

type AvatarServiceErrorCode =
  (typeof AVATAR_ERROR_CODES)[keyof typeof AVATAR_ERROR_CODES];

type AvatarServiceError = {
  code: AvatarServiceErrorCode;
  message: string;
  status: number;
};

type AvatarSourceQualityReport = {
  passed?: boolean;
};

const avatarInclude = {
  sourceAsset: true,
} satisfies Prisma.AvatarInclude;

export async function listReadyAvatars(input: { teamId: string }) {
  const avatars = await prisma.avatar.findMany({
    where: {
      teamId: input.teamId,
      status: AvatarStatus.ready,
      deletedAt: null,
    },
    include: avatarInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return serializeAvatars(avatars);
}

export async function createAvatarWithConsent(input: AvatarServiceInput<CreateAvatarRequest>) {
  const consentValidation = validateRequiredConsent(input.usageScope, input.consentText);
  if (consentValidation) {
    return avatarError(AVATAR_ERROR_CODES.consentRequired, 400);
  }

  const sourceAsset = await prisma.asset.findFirst({
    where: {
      id: input.sourceAssetId,
      teamId: input.teamId,
      type: AssetType.avatar_source,
      deletedAt: null,
    },
  });

  if (!sourceAsset) {
    return avatarError(AVATAR_ERROR_CODES.sourceAssetNotFound, 404);
  }

  if (!getAvatarSourceQualityReport(sourceAsset.metadata)?.passed) {
    return avatarError(AVATAR_ERROR_CODES.qualityNotPassed, 400);
  }

  const avatar = await prisma.$transaction(async (tx) => {
    const createdAvatar = await tx.avatar.create({
      data: {
        teamId: input.teamId,
        ownerId: input.userId,
        name: input.name,
        sourceAssetId: sourceAsset.id,
        status: AvatarStatus.ready,
        licenseStatus: LicenseStatus.approved,
        qualityReport: getAvatarSourceQualityReport(sourceAsset.metadata) as Prisma.InputJsonValue,
      },
      include: avatarInclude,
    });

    await tx.avatarConsent.create({
      data: {
        avatarId: createdAvatar.id,
        teamId: input.teamId,
        userId: input.userId,
        consentType: DEFAULT_AVATAR_CONSENT_TYPE,
        consentText: input.consentText,
        usageScope: input.usageScope,
        ipAddress: input.ipAddress,
        device: input.deviceJson as Prisma.InputJsonValue | undefined,
      },
    });

    return createdAvatar;
  });

  return {
    success: true as const,
    avatar: await serializeAvatar(avatar),
  };
}

export async function confirmAvatarConsent(input: AvatarServiceInput<AvatarConsentRequest> & {
  avatarId: string;
}) {
  const consentValidation = validateRequiredConsent(input.usageScope, input.consentText);
  if (consentValidation) {
    return avatarError(AVATAR_ERROR_CODES.consentRequired, 400);
  }

  const avatar = await prisma.avatar.findFirst({
    where: {
      id: input.avatarId,
      teamId: input.teamId,
      deletedAt: null,
    },
    include: avatarInclude,
  });

  if (!avatar) {
    return avatarError(AVATAR_ERROR_CODES.notFound, 404);
  }

  if (!getAvatarQualityReport(avatar.qualityReport)?.passed) {
    return avatarError(AVATAR_ERROR_CODES.qualityNotPassed, 400);
  }

  const updatedAvatar = await prisma.$transaction(async (tx) => {
    await tx.avatarConsent.create({
      data: {
        avatarId: avatar.id,
        teamId: input.teamId,
        userId: input.userId,
        consentType: DEFAULT_AVATAR_CONSENT_TYPE,
        consentText: input.consentText,
        usageScope: input.usageScope,
        ipAddress: input.ipAddress,
        device: input.deviceJson as Prisma.InputJsonValue | undefined,
      },
    });

    return tx.avatar.update({
      where: {
        id: avatar.id,
      },
      data: {
        status: AvatarStatus.ready,
        licenseStatus: LicenseStatus.approved,
      },
      include: avatarInclude,
    });
  });

  return {
    success: true as const,
    avatar: await serializeAvatar(updatedAvatar),
  };
}

export async function softDeleteAvatar(input: { avatarId: string; teamId: string }) {
  const avatar = await prisma.avatar.findFirst({
    where: {
      id: input.avatarId,
      teamId: input.teamId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!avatar) {
    return avatarError(AVATAR_ERROR_CODES.notFound, 404);
  }

  await prisma.avatar.update({
    where: {
      id: avatar.id,
    },
    data: {
      status: AvatarStatus.deleted,
      deletedAt: new Date(),
    },
  });

  return {
    success: true as const,
  };
}

function validateRequiredConsent(usageScope: string[], consentText: string) {
  if (!consentText.trim()) {
    return true;
  }

  return !AVATAR_CONSENT_USAGE_SCOPES.every((scope) => usageScope.includes(scope));
}

function getAvatarSourceQualityReport(metadata: Prisma.JsonValue): AvatarSourceQualityReport | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const qualityReport = (metadata as { qualityReport?: unknown }).qualityReport;
  return getAvatarQualityReport(qualityReport as Prisma.JsonValue);
}

function getAvatarQualityReport(value: Prisma.JsonValue): AvatarSourceQualityReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as AvatarSourceQualityReport;
}

function avatarError(code: AvatarServiceErrorCode, status: number) {
  return {
    success: false as const,
    error: {
      code,
      message: AVATAR_ERROR_MESSAGES[code],
      status,
    } satisfies AvatarServiceError,
  };
}
