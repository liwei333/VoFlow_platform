import type { PublishPlatform } from "@/lib/publish/rules";

export const PUBLISH_ERROR_CODES = {
  jobNotFound: "PUBLISH_JOB_NOT_FOUND",
  draftMissing: "PUBLISH_DRAFT_MISSING",
  validationFailed: "PUBLISH_VALIDATION_FAILED",
  publishNotFound: "PUBLISH_NOT_FOUND",
  retryNotAllowed: "PUBLISH_RETRY_NOT_ALLOWED",
} as const;

export const PUBLISH_SKIP_CODES = {
  channelTokenExpired: "CHANNEL_TOKEN_EXPIRED",
  channelAccountNotConnected: "CHANNEL_ACCOUNT_NOT_CONNECTED",
  validationFailed: "PUBLISH_VALIDATION_FAILED",
} as const;

export type PublishErrorCode =
  (typeof PUBLISH_ERROR_CODES)[keyof typeof PUBLISH_ERROR_CODES];

export type PublishSkipCode =
  (typeof PUBLISH_SKIP_CODES)[keyof typeof PUBLISH_SKIP_CODES];

export interface PublishValidationSnapshot {
  draftId: string | null;
  platform: PublishPlatform;
  passed: boolean;
  checkedAt: string;
  finalVideoArtifactId: string | null;
  coverArtifactId: string | null;
  checks: Array<{
    code: string;
    passed: boolean;
    message?: string;
    field?: string;
  }>;
}

export interface PublishRecordForSerialization {
  id: string;
  jobId: string;
  publishDraftId: string;
  channelAccountId: string;
  platform: PublishPlatform;
  status: "pending" | "uploading" | "published" | "failed" | "skipped";
  requestId: string | null;
  remoteId: string | null;
  errorJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedPublish {
  id: string;
  jobId: string;
  publishDraftId: string;
  channelAccountId: string;
  platform: PublishPlatform;
  status: "pending" | "uploading" | "published" | "failed" | "skipped";
  requestId: string | null;
  remoteId: string | null;
  errorJson: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PublishSummary {
  total: number;
  published: number;
  failed: number;
  skipped: number;
}

export interface PublishErrorHistoryEntry {
  status: "failed";
  requestId: string | null;
  remoteId: string | null;
  error: unknown;
}

export interface PublishRetryErrorHistory {
  history: PublishErrorHistoryEntry[];
  lastRetry: {
    previousRequestId: string;
    requestId: string | null;
    remoteId: string | null;
  };
  currentError?: unknown;
}

export function serializePublish(record: PublishRecordForSerialization): SerializedPublish {
  return {
    id: record.id,
    jobId: record.jobId,
    publishDraftId: record.publishDraftId,
    channelAccountId: record.channelAccountId,
    platform: record.platform,
    status: record.status,
    requestId: record.requestId,
    remoteId: record.remoteId,
    errorJson: record.errorJson,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function summarizePublishes(records: readonly SerializedPublish[]): PublishSummary {
  return {
    total: records.length,
    published: records.filter((record) => record.status === "published").length,
    failed: records.filter((record) => record.status === "failed").length,
    skipped: records.filter((record) => record.status === "skipped").length,
  };
}

export function readPublishValidationSnapshot(
  value: unknown,
  platform: PublishPlatform
): PublishValidationSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PublishValidationSnapshot>;
  if (
    candidate.platform !== platform ||
    typeof candidate.passed !== "boolean" ||
    !Array.isArray(candidate.checks)
  ) {
    return null;
  }

  return {
    draftId: typeof candidate.draftId === "string" ? candidate.draftId : null,
    platform,
    passed: candidate.passed,
    checkedAt: typeof candidate.checkedAt === "string" ? candidate.checkedAt : "",
    finalVideoArtifactId:
      typeof candidate.finalVideoArtifactId === "string" ? candidate.finalVideoArtifactId : null,
    coverArtifactId:
      typeof candidate.coverArtifactId === "string" ? candidate.coverArtifactId : null,
    checks: candidate.checks.filter(
      (
        check
      ): check is {
        code: string;
        passed: boolean;
        message?: string;
        field?: string;
      } =>
        Boolean(check) &&
        typeof check === "object" &&
        typeof (check as { code?: unknown }).code === "string" &&
        typeof (check as { passed?: unknown }).passed === "boolean"
    ),
  };
}

export function buildPublishRetryErrorHistory(input: {
  previousStatus: "failed";
  previousRequestId: string | null;
  previousRemoteId: string | null;
  previousErrorJson: unknown;
  retryPreviousRequestId: string;
  retryRequestId: string | null;
  retryRemoteId: string | null;
  currentError?: unknown;
}): PublishRetryErrorHistory {
  const existingHistory = readExistingErrorHistory(input.previousErrorJson);
  const history = [
    ...existingHistory,
    {
      status: input.previousStatus,
      requestId: input.previousRequestId,
      remoteId: input.previousRemoteId,
      error: readCurrentError(input.previousErrorJson),
    },
  ];

  return {
    history,
    lastRetry: {
      previousRequestId: input.retryPreviousRequestId,
      requestId: input.retryRequestId,
      remoteId: input.retryRemoteId,
    },
    ...(input.currentError === undefined ? {} : { currentError: input.currentError }),
  };
}

function readExistingErrorHistory(value: unknown): PublishErrorHistoryEntry[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const history = (value as { history?: unknown }).history;
  if (!Array.isArray(history)) {
    return [];
  }

  return history.filter((entry): entry is PublishErrorHistoryEntry => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }

    const candidate = entry as Partial<PublishErrorHistoryEntry>;
    return candidate.status === "failed";
  });
}

function readCurrentError(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const currentError = (value as { currentError?: unknown }).currentError;
  if (currentError !== undefined) {
    return currentError;
  }

  if (Array.isArray((value as { history?: unknown }).history)) {
    return null;
  }

  return value;
}
