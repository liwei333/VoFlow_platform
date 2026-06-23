import type { Prisma } from "@prisma/client";
import type { SerializedAsset } from "@/lib/assets/serializer";

type VoiceSampleForSerialization = {
  id: string;
  assetId: string;
  teamId: string;
  ownerId: string;
  durationMs: number | null;
  qualityReport: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedVoiceSample = {
  id: string;
  assetId: string;
  teamId: string;
  ownerId: string;
  durationMs: number | null;
  qualityReport: Prisma.JsonValue | null;
  asset?: SerializedAsset;
  createdAt: string;
  updatedAt: string;
};

type VoiceConsentForSerialization = {
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

export type SerializedVoiceConsent = {
  id: string;
  voiceSampleId: string;
  teamId: string;
  userId: string;
  consentText: string;
  usageScope: string[];
  ipAddress: string | null;
  device: Prisma.JsonValue | null;
  createdAt: string;
};

export function serializeVoiceSample(
  voiceSample: VoiceSampleForSerialization,
  asset?: SerializedAsset
): SerializedVoiceSample {
  return {
    id: voiceSample.id,
    assetId: voiceSample.assetId,
    teamId: voiceSample.teamId,
    ownerId: voiceSample.ownerId,
    durationMs: voiceSample.durationMs,
    qualityReport: voiceSample.qualityReport,
    ...(asset ? { asset } : {}),
    createdAt: voiceSample.createdAt.toISOString(),
    updatedAt: voiceSample.updatedAt.toISOString(),
  };
}

export function serializeVoiceConsent(
  consent: VoiceConsentForSerialization
): SerializedVoiceConsent {
  return {
    id: consent.id,
    voiceSampleId: consent.voiceSampleId,
    teamId: consent.teamId,
    userId: consent.userId,
    consentText: consent.consentText,
    usageScope: consent.usageScope,
    ipAddress: consent.ipAddress,
    device: consent.device,
    createdAt: consent.createdAt.toISOString(),
  };
}
