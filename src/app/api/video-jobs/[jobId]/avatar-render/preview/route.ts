import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { invalidJsonBody, internalError, notFound, success, validationError } from "@/lib/api-response";
import { VALID_ASPECT_RATIOS } from "@/lib/aspect-ratio";
import {
  AVATAR_RENDER_CROPS,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";
import {
  createPreviewAvatarRenderTask,
  type CreatePreviewAvatarRenderTaskResult,
} from "@/services/avatarRenderService";

const createPreviewAvatarRenderSchema = z.object({
  avatarId: z.string().trim().min(1),
  audioArtifactId: z.string().trim().min(1),
  aspectRatio: z.enum(VALID_ASPECT_RATIOS),
  crop: z.enum(AVATAR_RENDER_CROPS),
});

const AVATAR_RENDER_BAD_REQUEST_CODES: Set<AvatarRenderErrorCode> = new Set([
  AVATAR_RENDER_ERROR_CODES.avatarNotReady,
  AVATAR_RENDER_ERROR_CODES.avatarLicenseNotApproved,
  AVATAR_RENDER_ERROR_CODES.ttsAudioNotFound,
  AVATAR_RENDER_ERROR_CODES.aspectRatioMismatch,
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

    const parsed = createPreviewAvatarRenderSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createPreviewAvatarRenderTask({
      jobId,
      teamId: session.teamId,
      avatarId: parsed.data.avatarId,
      audioArtifactId: parsed.data.audioArtifactId,
      aspectRatio: parsed.data.aspectRatio,
      crop: parsed.data.crop,
    });

    if (!result.success) {
      return avatarRenderTaskErrorResponse(result);
    }

    return success(result.data, "预览渲染任务已创建");
  } catch (error) {
    console.error("Create avatar render preview task error:", error);
    return internalError();
  }
}

function avatarRenderTaskErrorResponse(
  result: Extract<CreatePreviewAvatarRenderTaskResult, { success: false }>
): NextResponse {
  if (result.error.code === AVATAR_RENDER_ERROR_CODES.jobNotFound) {
    return notFound(result.error.message);
  }

  if (AVATAR_RENDER_BAD_REQUEST_CODES.has(result.error.code)) {
    return NextResponse.json(result.error, { status: 400 });
  }

  return internalError(
    AVATAR_RENDER_ERROR_MESSAGES[result.error.code] ?? result.error.message
  );
}
