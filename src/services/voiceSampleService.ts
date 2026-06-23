import { AssetType, LicenseStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { uploadAssetFile, type UploadAssetFileResult } from "@/services/assetUploadService";
import {
  VOICE_CONSENT_USAGE_SCOPES,
  VOICE_SAMPLE_ASSET_METADATA_SOURCE,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
} from "@/lib/voice-clone/constants";
import type { VoiceSampleQualityReport } from "@/lib/voice-clone/quality";

const voiceConsentScopeSchema = z.enum(VOICE_CONSENT_USAGE_SCOPES);

export const voiceConsentRequestSchema = z.object({
  consentText: z.string().trim().min(1).max(10000),
  usageScope: z.array(voiceConsentScopeSchema).min(1),
  deviceJson: z.record(z.unknown()).optional(),
});

type VoiceSampleRecord = {
  id: string;
  assetId: string;
  teamId: string;
  ownerId: string;
  durationMs: number | null;
  qualityReport: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateVoiceSampleFromUploadInput = {
  teamId: string;
  userId: string;
  file: File;
  name?: string | null;
  durationMs?: number;
  qualityReport?: VoiceSampleQualityReport;
};

export type VoiceConsentRequest = z.infer<typeof voiceConsentRequestSchema>;

type VoiceSampleServiceInput<T> = T & {
  teamId: string;
  userId: string;
  ipAddress?: string;
};

type VoiceSampleServiceErrorCode =
  (typeof VOICE_SAMPLE_ERROR_CODES)[keyof typeof VOICE_SAMPLE_ERROR_CODES];

type VoiceSampleServiceError = {
  code: VoiceSampleServiceErrorCode;
  message: string;
  status: number;
};

const voiceSampleInclude = {
  asset: true,
} satisfies Prisma.VoiceSampleInclude;

type VoiceSampleWithAsset = Prisma.VoiceSampleGetPayload<{
  include: typeof voiceSampleInclude;
}>;

type VoiceConsentRecord = {
  id: string;
  voiceSampleId: string;
  teamId: string;
  userId: string;
  consentText: string;
  usageScope: string[];
  ipAddress: string | null;
  device: Prisma.JsonValue | null;
  createdAt: Date;
};

export type CreateVoiceSampleFromUploadResult =
  | Extract<UploadAssetFileResult<VoiceSampleRecord>, { success: true }>
  | Extract<UploadAssetFileResult<VoiceSampleRecord>, { success: false }>;

export async function createVoiceSampleFromUpload(
  input: CreateVoiceSampleFromUploadInput
): Promise<CreateVoiceSampleFromUploadResult> {
  return uploadAssetFile<VoiceSampleRecord>({
    teamId: input.teamId,
    userId: input.userId,
    file: input.file,
    assetType: AssetType.audio,
    name: input.name,
    metadata: {
      sourceType: VOICE_SAMPLE_ASSET_METADATA_SOURCE,
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.qualityReport ? { qualityReport: input.qualityReport } : {}),
    },
    auditMetadata: {
      sourceType: VOICE_SAMPLE_ASSET_METADATA_SOURCE,
      ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      ...(input.qualityReport ? { qualityPassed: input.qualityReport.passed } : {}),
    },
    logContext: "Voice sample upload",
    createRelated: (tx, asset) =>
      tx.voiceSample.create({
        data: {
          assetId: asset.id,
          teamId: input.teamId,
          ownerId: input.userId,
          durationMs: input.durationMs ?? null,
          qualityReport: input.qualityReport as Prisma.InputJsonValue | undefined,
        },
        select: {
          id: true,
          assetId: true,
          teamId: true,
          ownerId: true,
          durationMs: true,
          qualityReport: true,
          createdAt: true,
          updatedAt: true,
        },
    }),
  });
}

export async function confirmVoiceSampleConsent(
  input: VoiceSampleServiceInput<VoiceConsentRequest> & { voiceSampleId: string }
): Promise<
  | {
      success: true;
      voiceSample: VoiceSampleWithAsset;
      consent: VoiceConsentRecord;
    }
  | {
      success: false;
      error: VoiceSampleServiceError;
    }
> {
  if (validateRequiredVoiceConsent(input.usageScope, input.consentText)) {
    return voiceSampleError(VOICE_SAMPLE_ERROR_CODES.consentRequired, 400);
  }

  const voiceSample = await prisma.voiceSample.findFirst({
    where: {
      id: input.voiceSampleId,
      teamId: input.teamId,
    },
    include: voiceSampleInclude,
  });

  if (!voiceSample) {
    return voiceSampleError(VOICE_SAMPLE_ERROR_CODES.notFound, 404);
  }

  if (!getVoiceSampleQualityReport(voiceSample.qualityReport)?.passed) {
    return voiceSampleError(VOICE_SAMPLE_ERROR_CODES.qualityNotPassed, 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const consent = await tx.voiceConsent.create({
      data: {
        voiceSampleId: voiceSample.id,
        teamId: input.teamId,
        userId: input.userId,
        consentText: input.consentText,
        usageScope: input.usageScope,
        ipAddress: input.ipAddress,
        device: input.deviceJson as Prisma.InputJsonValue | undefined,
      },
      select: {
        id: true,
        voiceSampleId: true,
        teamId: true,
        userId: true,
        consentText: true,
        usageScope: true,
        ipAddress: true,
        device: true,
        createdAt: true,
      },
    });

    await tx.asset.update({
      where: { id: voiceSample.assetId },
      data: { licenseStatus: LicenseStatus.approved },
    });

    const updatedVoiceSample = await tx.voiceSample.findUniqueOrThrow({
      where: { id: voiceSample.id },
      include: voiceSampleInclude,
    });

    return {
      voiceSample: updatedVoiceSample,
      consent,
    };
  });

  return {
    success: true,
    voiceSample: result.voiceSample,
    consent: result.consent,
  };
}

function validateRequiredVoiceConsent(usageScope: string[], consentText: string) {
  if (!consentText.trim()) {
    return true;
  }

  return !VOICE_CONSENT_USAGE_SCOPES.every((scope) => usageScope.includes(scope));
}

function getVoiceSampleQualityReport(value: Prisma.JsonValue): { passed?: boolean } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as { passed?: boolean };
}

function voiceSampleError(code: VoiceSampleServiceErrorCode, status: number) {
  return {
    success: false as const,
    error: {
      code,
      message: VOICE_SAMPLE_ERROR_MESSAGES[code],
      status,
    } satisfies VoiceSampleServiceError,
  };
}
