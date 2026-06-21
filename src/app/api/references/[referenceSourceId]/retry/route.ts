import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import {
  retryReferenceSourceForTeam,
  type RetryReferenceSourceErrorCode,
} from "@/services/referenceSourceService";

const RETRY_BAD_REQUEST_CODES: Set<RetryReferenceSourceErrorCode> = new Set([
  "REFERENCE_RETRY_NOT_ALLOWED",
  "REFERENCE_INVALID_URL",
  "REFERENCE_PLATFORM_UNSUPPORTED",
  "REFERENCE_PARSE_FAILED",
  "REFERENCE_UNSUPPORTED_ASSET_TYPE",
  "ASSET_LICENSE_NOT_APPROVED",
  "REFERENCE_DURATION_REQUIRED",
  "REFERENCE_DURATION_LIMIT_EXCEEDED",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ referenceSourceId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { referenceSourceId } = await params;

  try {
    const result = await retryReferenceSourceForTeam({
      referenceSourceId,
      teamId: session.teamId,
      userId: session.userId,
    });

    if (!result.success) {
      return retryReferenceSourceErrorResponse(
        result.error.code,
        result.error.message,
        result.data
      );
    }

    const { message, ...data } = result.data;
    return success(data, message);
  } catch (error) {
    console.error("Retry reference source error:", error);
    return internalError();
  }
}

function retryReferenceSourceErrorResponse(
  code: RetryReferenceSourceErrorCode,
  message: string,
  data?: unknown
): NextResponse {
  if (code === "REFERENCE_SOURCE_NOT_FOUND") {
    return notFound(message);
  }

  if (code === "PROJECT_NOT_FOUND" || code === "REFERENCE_ASSET_NOT_FOUND") {
    return notFound(message);
  }

  if (
    code === "REFERENCE_EXTRACT_ENQUEUE_FAILED" ||
    code === "REFERENCE_SOURCE_RETRY_FAILED"
  ) {
    return internalError(message);
  }

  if (RETRY_BAD_REQUEST_CODES.has(code)) {
    return NextResponse.json(
      {
        code,
        message,
        ...(data ? { data } : {}),
      },
      { status: 400 }
    );
  }

  return internalError(message);
}
