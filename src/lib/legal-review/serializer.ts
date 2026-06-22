import type { LegalReview, LegalRiskItem } from "@prisma/client";

export interface SerializedLegalReview {
  id: string;
  teamId: string;
  ownerId: string;
  scriptCandidateId: string;
  jobId: string | null;
  status: string;
  summaryJson: unknown;
  reviewedScript: string;
  resolvedScript: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedLegalRiskItem {
  id: string;
  legalReviewId: string;
  riskType: string;
  severity: string;
  originalText: string;
  reason: string;
  suggestion: string | null;
  action: string;
  ignoredReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeLegalReview(review: LegalReview): SerializedLegalReview {
  return {
    id: review.id,
    teamId: review.teamId,
    ownerId: review.ownerId,
    scriptCandidateId: review.scriptCandidateId,
    jobId: review.jobId,
    status: review.status,
    summaryJson: review.summaryJson,
    reviewedScript: review.reviewedScript,
    resolvedScript: review.resolvedScript,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
  };
}

export function serializeLegalRiskItem(item: LegalRiskItem): SerializedLegalRiskItem {
  return {
    id: item.id,
    legalReviewId: item.legalReviewId,
    riskType: item.riskType,
    severity: item.severity,
    originalText: item.originalText,
    reason: item.reason,
    suggestion: item.suggestion,
    action: item.action,
    ignoredReason: item.ignoredReason,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
