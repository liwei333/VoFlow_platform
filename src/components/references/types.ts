export type ReferenceSourceStatus =
  | "pending"
  | "parsing"
  | "metadata_ready"
  | "transcribing"
  | "analyzing"
  | "succeeded"
  | "failed";

export type ReferenceSourceViewModel = {
  id: string;
  projectId: string;
  teamId: string;
  sourceType: string;
  platform: string | null;
  sourceUrl: string | null;
  assetId: string | null;
  status: ReferenceSourceStatus | string;
  durationMs: number | null;
  title?: string | null;
  thumbnailUrl?: string | null;
  metadataJson?: unknown;
  subtitleJson?: unknown;
  importMode?: "metadata_only" | "subtitle_only" | "audio_extract" | "uploaded_asset" | string | null;
  consentStatus?: "pending" | "confirmed" | "rejected" | string | null;
  consentConfirmedAt?: string | null;
  consentConfirmedBy?: string | null;
  transcript?: string | null;
  structureJson: unknown;
  errorJson: unknown;
  asset?: {
    id: string;
    name: string;
    type: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ReferenceMediaAssetViewModel = {
  id: string;
  type: "audio" | "video" | string;
  name: string;
  fileName: string;
  metadata: unknown;
  licenseStatus: string;
  createdAt: string;
};
