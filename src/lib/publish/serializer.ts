import { getPublishPlatformRule, type PublishPlatform } from "@/lib/publish/rules";

export interface PublishDraftRecord {
  id: string;
  jobId: string;
  platform: PublishPlatform;
  title: string;
  description: string;
  tagsJson: unknown;
  topicsJson: unknown;
  coverArtifactId: string | null;
  validationJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedPublishDraft {
  id: string;
  jobId: string;
  platform: PublishPlatform;
  title: string;
  description: string;
  tags: string[];
  topics: string[];
  coverArtifactId: string | null;
  validationJson: unknown;
  rule: ReturnType<typeof getPublishPlatformRule>;
  createdAt: string;
  updatedAt: string;
}

export function serializePublishDraft(draft: PublishDraftRecord): SerializedPublishDraft {
  return {
    id: draft.id,
    jobId: draft.jobId,
    platform: draft.platform,
    title: draft.title,
    description: draft.description,
    tags: readStringArray(draft.tagsJson),
    topics: readStringArray(draft.topicsJson),
    coverArtifactId: draft.coverArtifactId,
    validationJson: draft.validationJson,
    rule: getPublishPlatformRule(draft.platform),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
