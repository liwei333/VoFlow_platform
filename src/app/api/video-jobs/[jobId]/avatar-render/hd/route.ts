import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import {
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";
import {
  createHdAvatarRenderTask,
  type CreateHdAvatarRenderTaskResult,
} from "@/services/avatarRenderService";

const createHdAvatarRenderSchema = z.object({
  previewAvatarRenderRequestId: z.string().trim().min(1),
});

const AVATAR_RENDER_BAD_REQUEST_CODES: Set<AvatarRenderErrorCode> = new Set([
  AVATAR_RENDER_ERROR_CODES.previewNotApproved,
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { jobId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = createHdAvatarRenderSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createHdAvatarRenderTask({
      jobId,
      teamId: session.teamId,
      previewAvatarRenderRequestId: parsed.data.previewAvatarRenderRequestId,
    });

    if (!result.success) {
      return avatarRenderHdTaskErrorResponse(result);
    }

    return success(result.data, "高清渲染任务已创建");
  } catch (error) {
    console.error("Create avatar render hd task error:", error);
    return internalError();
  }
}

function avatarRenderHdTaskErrorResponse(
  result: Extract<CreateHdAvatarRenderTaskResult, { success: false }>
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
