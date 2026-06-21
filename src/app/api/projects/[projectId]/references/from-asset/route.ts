import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import {
  REFERENCE_ASSET_ERROR_MESSAGES,
  type ReferenceAssetErrorCode,
} from "@/services/referenceAssetService";
import {
  createReferenceExtractTask,
  type CreateReferenceExtractTaskResult,
} from "@/services/referenceAsrService";

const createFromAssetSchema = z.object({
  assetId: z.string().min(1),
});

const REFERENCE_ASSET_ERROR_STATUS: Record<
  Exclude<ReferenceAssetErrorCode, "PROJECT_NOT_FOUND" | "REFERENCE_ASSET_NOT_FOUND">,
  number
> = {
  REFERENCE_UNSUPPORTED_ASSET_TYPE: 400,
  ASSET_LICENSE_NOT_APPROVED: 400,
  REFERENCE_DURATION_REQUIRED: 400,
  REFERENCE_DURATION_LIMIT_EXCEEDED: 400,
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

    const parsed = createFromAssetSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createReferenceExtractTask({
      projectId,
      teamId: session.teamId,
      userId: session.userId,
      assetId: parsed.data.assetId,
    });

    if (!result.success) {
      return referenceFromAssetErrorResponse(result);
    }

    return success(result.data, "参考素材提取任务已创建");
  } catch (error) {
    console.error("Create reference extraction task error:", error);
    return internalError();
  }
}

function referenceFromAssetErrorResponse(
  result: Extract<CreateReferenceExtractTaskResult, { success: false }>
): NextResponse {
  const code = result.error.code;

  if (code === "PROJECT_NOT_FOUND") {
    return notFound("项目不存在");
  }

  if (code === "REFERENCE_ASSET_NOT_FOUND") {
    return notFound("素材不存在");
  }

  if (code === "REFERENCE_EXTRACT_ENQUEUE_FAILED") {
    return internalError("队列投递失败");
  }

  return NextResponse.json(
    {
      code,
      message: REFERENCE_ASSET_ERROR_MESSAGES[code],
    },
    { status: REFERENCE_ASSET_ERROR_STATUS[code] }
  );
}
