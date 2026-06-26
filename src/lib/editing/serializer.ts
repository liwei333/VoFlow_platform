import type { Artifact, EditingConfig, Prisma } from "@prisma/client";
import { DEFAULT_EDITING_CONFIG } from "@/lib/editing/constants";

type EditingPreviewArtifact = Pick<
  Artifact,
  "id" | "type" | "storageUrl" | "metadata" | "createdAt"
>;

export type EditingConfigRecord = EditingConfig & {
  previewArtifact: EditingPreviewArtifact | null;
};

export type SerializedEditingPreviewArtifact = {
  id: string;
  type: string;
  storageUrl: string;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

export type SerializedEditingConfig = {
  id: string | null;
  jobId: string;
  isDefault: boolean;
  subtitleEnabled: boolean;
  keywordHighlightEnabled: boolean;
  bgmDuckingEnabled: boolean;
  pipEnabled: boolean;
  pipAssetId: string | null;
  pipPosition: string;
  pipSize: number;
  backgroundAssetId: string | null;
  voiceVolume: number;
  bgmVolume: number;
  transitionStrength: number;
  configJson: Prisma.JsonValue | null;
  previewArtifactId: string | null;
  previewArtifact: SerializedEditingPreviewArtifact | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export function serializeDefaultEditingConfig(jobId: string): SerializedEditingConfig {
  return {
    id: null,
    jobId,
    isDefault: true,
    ...DEFAULT_EDITING_CONFIG,
    previewArtifact: null,
    createdAt: null,
    updatedAt: null,
  };
}

export function serializeEditingConfig(
  config: EditingConfigRecord
): SerializedEditingConfig {
  return {
    id: config.id,
    jobId: config.jobId,
    isDefault: false,
    subtitleEnabled: config.subtitleEnabled,
    keywordHighlightEnabled: config.keywordHighlightEnabled,
    bgmDuckingEnabled: config.bgmDuckingEnabled,
    pipEnabled: config.pipEnabled,
    pipAssetId: config.pipAssetId,
    pipPosition: config.pipPosition,
    pipSize: config.pipSize,
    backgroundAssetId: config.backgroundAssetId,
    voiceVolume: config.voiceVolume,
    bgmVolume: config.bgmVolume,
    transitionStrength: config.transitionStrength,
    configJson: config.configJson,
    previewArtifactId: config.previewArtifactId,
    previewArtifact: config.previewArtifact
      ? serializeEditingPreviewArtifact(config.previewArtifact)
      : null,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

function serializeEditingPreviewArtifact(
  artifact: EditingPreviewArtifact
): SerializedEditingPreviewArtifact {
  return {
    id: artifact.id,
    type: artifact.type,
    storageUrl: artifact.storageUrl,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt.toISOString(),
  };
}
