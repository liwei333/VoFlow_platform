import { NextResponse } from "next/server";
import { internalError, notFound } from "@/lib/api-response";
import {
  LEGAL_REVIEW_ERROR_CODES,
  LEGAL_REVIEW_ERROR_MESSAGES,
  type LegalReviewErrorCode,
} from "@/lib/legal-review/constants";

const LEGAL_NOT_FOUND_CODES = new Set<LegalReviewErrorCode>([
  LEGAL_REVIEW_ERROR_CODES.candidateNotFound,
  LEGAL_REVIEW_ERROR_CODES.reviewNotFound,
  LEGAL_REVIEW_ERROR_CODES.riskItemNotFound,
]);

const LEGAL_BAD_REQUEST_CODES = new Set<LegalReviewErrorCode>([
  LEGAL_REVIEW_ERROR_CODES.ignoreReasonRequired,
  LEGAL_REVIEW_ERROR_CODES.invalidAction,
]);

export function legalReviewErrorResponse(error: {
  code: LegalReviewErrorCode;
  message: string;
}): NextResponse {
  if (LEGAL_NOT_FOUND_CODES.has(error.code)) {
    return notFound(error.message);
  }

  if (LEGAL_BAD_REQUEST_CODES.has(error.code)) {
    return NextResponse.json(error, { status: 400 });
  }

  return internalError(LEGAL_REVIEW_ERROR_MESSAGES[error.code] ?? error.message);
}
