import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import {
  confirmReferenceUrlImport,
  type ConfirmReferenceUrlImportErrorCode,
} from "@/services/referenceUrlImportService";

const importReferenceUrlSchema = z.object({
  importMode: z.enum(["metadata_only", "subtitle_only", "audio_extract"]),
  consentTextVersion: z.string().trim().min(1).optional(),
  consentConfirmed: z.boolean().optional(),
});

const REFERENCE_URL_IMPORT_ERROR_STATUS: Record<
  Exclude<ConfirmReferenceUrlImportErrorCode, "REFERENCE_SOURCE_NOT_FOUND">,
  number
> = {
  REFERENCE_IMPORT_CONSENT_REQUIRED: 400,
  REFERENCE_AUDIO_EXTRACT_DISABLED: 400,
  REFERENCE_IMPORT_NOT_READY: 400,
  REFERENCE_URL_IMPORT_ENQUEUE_FAILED: 500,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; referenceSourceId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { projectId, referenceSourceId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = importReferenceUrlSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await confirmReferenceUrlImport({
      projectId,
      referenceSourceId,
      teamId: session.teamId,
      userId: session.userId,
      importMode: parsed.data.importMode,
      consentTextVersion: parsed.data.consentTextVersion,
      consentConfirmed: parsed.data.consentConfirmed,
    });

    if (!result.success) {
      return referenceUrlImportErrorResponse(result.error.code, result.error.message);
    }

    return success(result.data, "参考链接导入确认已保存");
  } catch (error) {
    console.error("Confirm reference URL import error:", error);
    return internalError();
  }
}

function referenceUrlImportErrorResponse(
  code: ConfirmReferenceUrlImportErrorCode,
  message: string
): NextResponse {
  if (code === "REFERENCE_SOURCE_NOT_FOUND") {
    return notFound("参考来源不存在");
  }

  return NextResponse.json(
    {
      code,
      message,
    },
    { status: REFERENCE_URL_IMPORT_ERROR_STATUS[code] }
  );
}
