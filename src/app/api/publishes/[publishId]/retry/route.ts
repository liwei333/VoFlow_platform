import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { PUBLISH_ERROR_CODES } from "@/lib/publish/publish";
import { retryPublish } from "@/services/publishService";

interface RouteContext {
  params: Promise<{ publishId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { publishId } = await context.params;

  try {
    const result = await retryPublish({
      publishId,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
    });

    if (!result.success) {
      if (result.error.code === PUBLISH_ERROR_CODES.publishNotFound) {
        return notFound(result.error.message);
      }

      if (
        result.error.code === PUBLISH_ERROR_CODES.retryNotAllowed ||
        result.error.code === PUBLISH_ERROR_CODES.validationFailed
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "发布重试已提交");
  } catch (error) {
    console.error("Retry publish error:", error);
    return internalError();
  }
}
