import { AssetType, Prisma } from "@prisma/client";

export const REFERENCE_MEDIA_ASSET_TYPES = [AssetType.audio, AssetType.video] as const;

export type ReferenceMediaAssetType = (typeof REFERENCE_MEDIA_ASSET_TYPES)[number];

export const REFERENCE_MEDIA_DURATION_LIMIT_MS = 3 * 60 * 1000;

export function isReferenceMediaAssetType(value: unknown): value is ReferenceMediaAssetType {
  return (
    typeof value === "string" &&
    (REFERENCE_MEDIA_ASSET_TYPES as readonly string[]).includes(value)
  );
}

export function getReferenceMediaDurationMs(metadata: Prisma.JsonValue | null): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const durationMs = metadata.durationMs;
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return Math.round(durationMs);
  }

  const durationSeconds = metadata.durationSeconds;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.round(durationSeconds * 1000);
  }

  return null;
}
