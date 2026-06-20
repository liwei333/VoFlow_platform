import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import { createAsrTranscriptionTask, type CreateAsrTranscriptionTaskErrorCode } from "@/services/scriptService";

const createFromMediaSchema = z.object({
  assetId: z.string().min(1),
});

const SCRIPT_FROM_MEDIA_ERROR_RESPONSES: Record<
  Exclude<CreateAsrTranscriptionTaskErrorCode, "PROJECT_NOT_FOUND" | "ASSET_NOT_FOUND" | "ENQUEUE_FAILED">,
  { code: string; message: string; status: number }
> = {
  ASSET_LICENSE_NOT_APPROVED: {
    code: "ASSET_LICENSE_NOT_APPROVED",
    message: "素材授权未确认",
    status: 400,
  },
  ASR_UNSUPPORTED_ASSET_TYPE: {
    code: "ASR_UNSUPPORTED_ASSET_TYPE",
    message: "仅支持音频或视频素材转写",
    status: 400,
  },
  ASR_DURATION_REQUIRED: {
    code: "ASR_DURATION_REQUIRED",
    message: "音视频时长缺失",
    status: 400,
  },
  ASR_DURATION_LIMIT_EXCEEDED: {
    code: "ASR_DURATION_LIMIT_EXCEEDED",
    message: "音视频时长超过 3 分钟",
    status: 400,
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { projectId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = createFromMediaSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createAsrTranscriptionTask({
      projectId,
      teamId: session.teamId,
      userId: session.userId,
      assetId: parsed.data.assetId,
    });

    if (!result.success) {
      return scriptFromMediaErrorResponse(result.error.code);
    }

    return success(result.data, "转写任务已创建");
  } catch (error) {
    console.error("Create ASR transcription task error:", error);
    return internalError();
  }
}

function scriptFromMediaErrorResponse(code: CreateAsrTranscriptionTaskErrorCode): NextResponse {
  if (code === "PROJECT_NOT_FOUND") {
    return notFound("项目不存在");
  }

  if (code === "ASSET_NOT_FOUND") {
    return notFound("素材不存在");
  }

  if (code === "ENQUEUE_FAILED") {
    return internalError("队列投递失败");
  }

  const response = SCRIPT_FROM_MEDIA_ERROR_RESPONSES[code];
  return NextResponse.json(
    {
      code: response.code,
      message: response.message,
    },
    { status: response.status }
  );
}
