import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import {
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";
import {
  retryAvatarRenderPreview,
  type RetryAvatarRenderPreviewResult,
} from "@/services/avatarRenderService";

type RouteContext = {
  params: Promise<{
    jobId: string;
    avatarRenderRequestId: string;
  }>;
};

const AVATAR_RENDER_BAD_REQUEST_CODES: Set<AvatarRenderErrorCode> = new Set([
  AVATAR_RENDER_ERROR_CODES.previewNotWaitingApproval,
]);

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { jobId, avatarRenderRequestId } = await context.params;

  try {
    const result = await retryAvatarRenderPreview({
      jobId,
      teamId: auth.context.session.teamId,
      avatarRenderRequestId,
    });

    if (!result.success) {
      return avatarRenderPreviewActionErrorResponse(result);
    }

    return success(result.data, "预览渲染已重新创建");
  } catch (error) {
    console.error("Retry avatar render preview error:", error);
    return internalError();
  }
}

function avatarRenderPreviewActionErrorResponse(
  result: Extract<RetryAvatarRenderPreviewResult, { success: false }>
): NextResponse {
  if (
    result.error.code === AVATAR_RENDER_ERROR_CODES.jobNotFound ||
    result.error.code === AVATAR_RENDER_ERROR_CODES.renderRequestNotFound
  ) {
    return notFound(result.error.message);
  }

  if (AVATAR_RENDER_BAD_REQUEST_CODES.has(result.error.code)) {
    return NextResponse.json(result.error, { status: 400 });
  }

  return internalError(
    AVATAR_RENDER_ERROR_MESSAGES[result.error.code] ?? result.error.message
  );
}
