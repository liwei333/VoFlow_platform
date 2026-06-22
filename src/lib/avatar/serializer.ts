import { AvatarStatus, LicenseStatus, Prisma } from "@prisma/client";
import { serializeAsset, type SerializedAsset } from "@/lib/assets/serializer";

type AvatarSourceAsset = Parameters<typeof serializeAsset>[0];

export type AvatarForSerialization = {
  id: string;
  teamId: string;
  ownerId: string;
  name: string;
  sourceAssetId: string;
  provider: string | null;
  status: AvatarStatus;
  licenseStatus: LicenseStatus;
  qualityReport: Prisma.JsonValue | null;
  previewUrl: string | null;
  metadata: Prisma.JsonValue | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  sourceAsset: AvatarSourceAsset;
};

export type SerializedAvatar = {
  id: string;
  teamId: string;
  ownerId: string;
  name: string;
  sourceAssetId: string;
  provider: string | null;
  status: AvatarStatus;
  licenseStatus: LicenseStatus;
  qualityReport: Prisma.JsonValue | null;
  previewUrl: string | null;
  metadata: Prisma.JsonValue | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceAsset: SerializedAsset;
};

export async function serializeAvatar(avatar: AvatarForSerialization): Promise<SerializedAvatar> {
  const sourceAsset = await serializeAsset(avatar.sourceAsset, {
    onAccessUrlError: (error) => {
      console.error("Failed to generate avatar source URL:", error);
    },
  });

  return {
    id: avatar.id,
    teamId: avatar.teamId,
    ownerId: avatar.ownerId,
    name: avatar.name,
    sourceAssetId: avatar.sourceAssetId,
    provider: avatar.provider,
    status: avatar.status,
    licenseStatus: avatar.licenseStatus,
    qualityReport: avatar.qualityReport,
    previewUrl: avatar.previewUrl,
    metadata: avatar.metadata,
    isDefault: avatar.isDefault,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
    sourceAsset,
  };
}

export async function serializeAvatars(avatars: AvatarForSerialization[]) {
  return Promise.all(avatars.map((avatar) => serializeAvatar(avatar)));
}
