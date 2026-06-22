import { AuditAction, Prisma } from "@prisma/client";
import {
  LEGAL_REVIEW_ERROR_CODES,
  LEGAL_REVIEW_ERROR_MESSAGES,
  LEGAL_REVIEW_STATUSES,
  LEGAL_RISK_ACTIONS,
  LEGAL_RISK_SEVERITIES,
  type LegalRiskResolveAction,
  type LegalReviewErrorCode,
} from "@/lib/legal-review/constants";
import {
  buildLegalReviewSummary,
  scanLegalRiskFindings,
  type LegalReviewSummary,
} from "@/lib/legal-review/rules";
import {
  serializeLegalReview,
  serializeLegalRiskItem,
  type SerializedLegalReview,
  type SerializedLegalRiskItem,
} from "@/lib/legal-review/serializer";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { explainLegalRiskFindings } from "@/services/legalReviewLlmProvider";

export interface CreateLegalReviewForCandidateInput {
  candidateId: string;
  jobId?: string;
  teamId: string;
  userId: string;
}

export interface ReplaceAllLegalRiskItemsInput {
  reviewId: string;
  teamId: string;
}

export interface ResolveLegalRiskItemInput {
  riskItemId: string;
  teamId: string;
  userId: string;
  action: LegalRiskResolveAction;
  ignoredReason?: string;
}

export interface AssertLegalReviewResolvedForTtsInput {
  scriptCandidateId: string;
  teamId: string;
}

export interface LegalReviewWithItemsOutput {
  review: SerializedLegalReview;
  riskItems: SerializedLegalRiskItem[];
}

export type LegalReviewServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: LegalReviewErrorCode; message: string } };

export async function createLegalReviewForCandidate(
  input: CreateLegalReviewForCandidateInput
): Promise<LegalReviewServiceResult<LegalReviewWithItemsOutput>> {
  const candidate = await prisma.scriptCandidate.findFirst({
    where: {
      id: input.candidateId,
      script: {
        project: {
          teamId: input.teamId,
        },
      },
    },
    include: {
      script: {
        select: {
          projectId: true,
        },
      },
    },
  });

  if (!candidate) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.candidateNotFound);
  }

  if (input.jobId) {
    const job = await prisma.videoJob.findFirst({
      where: {
        id: input.jobId,
        teamId: input.teamId,
        projectId: candidate.script.projectId,
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      return legalError(LEGAL_REVIEW_ERROR_CODES.reviewNotFound, "视频任务不存在");
    }
  }

  const ruleFindings = scanLegalRiskFindings(candidate.content);
  const findings = await explainLegalRiskFindings({
    content: candidate.content,
    findings: ruleFindings,
  });
  const summary = buildLegalReviewSummary(findings);
  const status = summary.requiresApproval
    ? LEGAL_REVIEW_STATUSES.waitingApproval
    : LEGAL_REVIEW_STATUSES.approved;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.legalReview.create({
        data: {
          teamId: input.teamId,
          ownerId: input.userId,
          scriptCandidateId: candidate.id,
          jobId: input.jobId,
          status,
          summaryJson: toPrismaJson(summary),
          reviewedScript: candidate.content,
        },
      });

      const riskItems = await Promise.all(
        findings.map((finding) =>
          tx.legalRiskItem.create({
            data: {
              legalReviewId: review.id,
              riskType: finding.riskType,
              severity: finding.severity,
              originalText: finding.originalText,
              reason: finding.reason,
              suggestion: finding.suggestion,
              action: LEGAL_RISK_ACTIONS.pending,
            },
          })
        )
      );

      return { review, riskItems };
    });

    return {
      success: true,
      data: {
        review: serializeLegalReview(result.review),
        riskItems: result.riskItems.map(serializeLegalRiskItem),
      },
    };
  } catch {
    return legalError(LEGAL_REVIEW_ERROR_CODES.ruleEngineFailed);
  }
}

export async function getLegalReview(
  reviewId: string,
  teamId: string
): Promise<LegalReviewServiceResult<LegalReviewWithItemsOutput>> {
  const review = await prisma.legalReview.findFirst({
    where: {
      id: reviewId,
      teamId,
    },
    include: {
      riskItems: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!review) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.reviewNotFound);
  }

  return {
    success: true,
    data: {
      review: serializeLegalReview(review),
      riskItems: review.riskItems.map(serializeLegalRiskItem),
    },
  };
}

export async function replaceAllLegalRiskItems(
  input: ReplaceAllLegalRiskItemsInput
): Promise<LegalReviewServiceResult<LegalReviewWithItemsOutput>> {
  const review = await prisma.legalReview.findFirst({
    where: {
      id: input.reviewId,
      teamId: input.teamId,
    },
    include: {
      riskItems: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!review) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.reviewNotFound);
  }

  const resolvedScript = applyRiskItemSuggestions(
    review.resolvedScript ?? review.reviewedScript,
    review.riskItems
  );

  const result = await prisma.$transaction(async (tx) => {
    await tx.legalRiskItem.updateMany({
      where: {
        legalReviewId: review.id,
        action: LEGAL_RISK_ACTIONS.pending,
        suggestion: {
          not: null,
        },
      },
      data: {
        action: LEGAL_RISK_ACTIONS.replaced,
      },
    });

    const updatedItems = await tx.legalRiskItem.findMany({
      where: {
        legalReviewId: review.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    const status = hasPendingHighRisk(updatedItems)
      ? LEGAL_REVIEW_STATUSES.waitingApproval
      : LEGAL_REVIEW_STATUSES.approved;
    const updatedReview = await tx.legalReview.update({
      where: {
        id: review.id,
      },
      data: {
        resolvedScript,
        status,
      },
    });

    return {
      review: updatedReview,
      riskItems: updatedItems,
    };
  });

  return {
    success: true,
    data: {
      review: serializeLegalReview(result.review),
      riskItems: result.riskItems.map(serializeLegalRiskItem),
    },
  };
}

export async function resolveLegalRiskItem(
  input: ResolveLegalRiskItemInput
): Promise<LegalReviewServiceResult<LegalReviewWithItemsOutput>> {
  if (input.action === LEGAL_RISK_ACTIONS.ignored && !input.ignoredReason?.trim()) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.ignoreReasonRequired);
  }

  const riskItem = await prisma.legalRiskItem.findFirst({
    where: {
      id: input.riskItemId,
      legalReview: {
        teamId: input.teamId,
      },
    },
    include: {
      legalReview: true,
    },
  });

  if (!riskItem) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.riskItemNotFound);
  }

  const nextResolvedScript =
    input.action === LEGAL_RISK_ACTIONS.replaced
      ? replaceText(
          riskItem.legalReview.resolvedScript ?? riskItem.legalReview.reviewedScript,
          riskItem.originalText,
          riskItem.suggestion ?? riskItem.originalText
        )
      : riskItem.legalReview.resolvedScript;

  const result = await prisma.$transaction(async (tx) => {
    await tx.legalRiskItem.update({
      where: {
        id: riskItem.id,
      },
      data: {
        action: input.action,
        ignoredReason:
          input.action === LEGAL_RISK_ACTIONS.ignored ? input.ignoredReason?.trim() : null,
      },
    });

    if (input.action === LEGAL_RISK_ACTIONS.ignored) {
      await writeAuditLog(
        AuditAction.legal_risk_resolve,
        "legal_risk_item",
        riskItem.id,
        {
          action: input.action,
          ignoredReason: input.ignoredReason?.trim(),
          legalReviewId: riskItem.legalReviewId,
          riskType: riskItem.riskType,
          severity: riskItem.severity,
        },
        {
          teamId: input.teamId,
          userId: input.userId,
        },
        tx
      );
    }

    const updatedItems = await tx.legalRiskItem.findMany({
      where: {
        legalReviewId: riskItem.legalReviewId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    const status = hasPendingHighRisk(updatedItems)
      ? LEGAL_REVIEW_STATUSES.waitingApproval
      : LEGAL_REVIEW_STATUSES.approved;
    const updatedReview = await tx.legalReview.update({
      where: {
        id: riskItem.legalReviewId,
      },
      data: {
        resolvedScript: nextResolvedScript,
        status,
      },
    });

    return {
      review: updatedReview,
      riskItems: updatedItems,
    };
  });

  return {
    success: true,
    data: {
      review: serializeLegalReview(result.review),
      riskItems: result.riskItems.map(serializeLegalRiskItem),
    },
  };
}

export async function assertLegalReviewResolvedForTts(
  input: AssertLegalReviewResolvedForTtsInput
): Promise<LegalReviewServiceResult<{ script: string | null }>> {
  const latestReview = await prisma.legalReview.findFirst({
    where: {
      scriptCandidateId: input.scriptCandidateId,
      teamId: input.teamId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      riskItems: true,
    },
  });

  if (!latestReview) {
    return {
      success: true,
      data: {
        script: null,
      },
    };
  }

  if (hasPendingHighRisk(latestReview.riskItems)) {
    return legalError(LEGAL_REVIEW_ERROR_CODES.highRiskUnresolved);
  }

  return {
    success: true,
    data: {
      script: latestReview.resolvedScript ?? latestReview.reviewedScript,
    },
  };
}

function applyRiskItemSuggestions(
  script: string,
  riskItems: Array<{ originalText: string; suggestion: string | null; action: string }>
): string {
  return riskItems.reduce((nextScript, item) => {
    if (item.action !== LEGAL_RISK_ACTIONS.pending || !item.suggestion) {
      return nextScript;
    }

    return replaceText(nextScript, item.originalText, item.suggestion);
  }, script);
}

function replaceText(script: string, originalText: string, suggestion: string): string {
  return script.split(originalText).join(suggestion);
}

function hasPendingHighRisk(
  riskItems: Array<{ severity: string; action: string }>
): boolean {
  return riskItems.some(
    (item) =>
      item.severity === LEGAL_RISK_SEVERITIES.high &&
      item.action === LEGAL_RISK_ACTIONS.pending
  );
}

function legalError(
  code: LegalReviewErrorCode,
  message = LEGAL_REVIEW_ERROR_MESSAGES[code]
): Extract<LegalReviewServiceResult<never>, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function toPrismaJson(value: LegalReviewSummary): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
