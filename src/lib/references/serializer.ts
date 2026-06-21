import type { AssetType, Prisma, ReferenceSourceStatus, ReferenceSourceType } from "@prisma/client";

type ReferenceAssetForSerialization = {
  id: string;
  name: string;
  type: AssetType;
};

export type ReferenceSourceForSerialization = {
  id: string;
  projectId: string;
  teamId: string;
  sourceType: ReferenceSourceType;
  platform: string | null;
  sourceUrl: string | null;
  assetId: string | null;
  status: ReferenceSourceStatus;
  durationMs: number | null;
  structureJson: Prisma.JsonValue | null;
  errorJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  asset?: ReferenceAssetForSerialization | null;
  transcriptScript?: {
    content: string;
  } | null;
};

export type SerializedReferenceSource = {
  id: string;
  projectId: string;
  teamId: string;
  sourceType: ReferenceSourceType;
  platform: string | null;
  sourceUrl: string | null;
  assetId: string | null;
  status: ReferenceSourceStatus;
  durationMs: number | null;
  transcript: string | null;
  structureJson: Prisma.JsonValue | null;
  errorJson: Prisma.JsonValue | null;
  asset: ReferenceAssetForSerialization | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeReferenceSource(
  source: ReferenceSourceForSerialization
): SerializedReferenceSource {
  return {
    id: source.id,
    projectId: source.projectId,
    teamId: source.teamId,
    sourceType: source.sourceType,
    platform: source.platform,
    sourceUrl: source.sourceUrl,
    assetId: source.assetId,
    status: source.status,
    durationMs: source.durationMs,
    transcript: source.transcriptScript?.content ?? null,
    structureJson: source.structureJson,
    errorJson: source.errorJson,
    asset: source.asset ?? null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function serializeReferenceSources(
  sources: ReferenceSourceForSerialization[]
): SerializedReferenceSource[] {
  return sources.map(serializeReferenceSource);
}
