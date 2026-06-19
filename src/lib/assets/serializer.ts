import { AssetType, LicenseStatus, Prisma } from "@prisma/client";
import { generatePresignedUrl } from "@/lib/storage";

export const ASSET_ACCESS_URL_EXPIRES_SECONDS = 60 * 60;

type AssetForSerialization = {
  id: string;
  teamId: string;
  ownerId: string;
  type: AssetType;
  name: string;
  storageUrl: string;
  mimeType: string;
  sizeBytes: bigint;
  metadata: Prisma.JsonValue | null;
  licenseStatus: LicenseStatus;
  createdAt: Date;
  updatedAt: Date;
};

type GenerateAccessUrl = (
  teamId: string,
  assetId: string,
  fileName: string,
  expiresInSeconds: number
) => Promise<string>;

type SerializeAssetOptions = {
  generateAccessUrl?: GenerateAccessUrl;
  onAccessUrlError?: (error: unknown, asset: AssetForSerialization) => void;
};

export type SerializedAsset = {
  id: string;
  teamId: string;
  ownerId: string;
  type: AssetType;
  name: string;
  storageUrl: string;
  fileName: string;
  accessUrl: string;
  mimeType: string;
  sizeBytes: string;
  metadata: Prisma.JsonValue | null;
  licenseStatus: LicenseStatus;
  createdAt: Date;
  updatedAt: Date;
};

export function getAssetFileName(storageUrl: string): string {
  return storageUrl.substring(storageUrl.lastIndexOf("/") + 1);
}

export async function serializeAsset(
  asset: AssetForSerialization,
  options: SerializeAssetOptions = {}
): Promise<SerializedAsset> {
  const fileName = getAssetFileName(asset.storageUrl);
  const generateAccessUrl = options.generateAccessUrl ?? generatePresignedUrl;

  let accessUrl = "";
  try {
    accessUrl = await generateAccessUrl(
      asset.teamId,
      asset.id,
      fileName,
      ASSET_ACCESS_URL_EXPIRES_SECONDS
    );
  } catch (error) {
    options.onAccessUrlError?.(error, asset);
  }

  return {
    id: asset.id,
    teamId: asset.teamId,
    ownerId: asset.ownerId,
    type: asset.type,
    name: asset.name,
    storageUrl: asset.storageUrl,
    fileName,
    accessUrl,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes.toString(),
    metadata: asset.metadata,
    licenseStatus: asset.licenseStatus,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

export async function serializeAssets(
  assets: AssetForSerialization[],
  options: SerializeAssetOptions = {}
): Promise<SerializedAsset[]> {
  return Promise.all(assets.map((asset) => serializeAsset(asset, options)));
}
