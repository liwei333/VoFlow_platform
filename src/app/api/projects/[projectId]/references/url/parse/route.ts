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
  parseReferenceUrlMetadata,
  type ParseReferenceUrlMetadataErrorCode,
} from "@/services/referenceUrlImportService";

const parseReferenceUrlSchema = z.object({
  sourceUrl: z.string().trim().min(1),
});

const REFERENCE_URL_IMPORT_ERROR_STATUS: Record<
  Exclude<ParseReferenceUrlMetadataErrorCode, "PROJECT_NOT_FOUND" | "REFERENCE_SOURCE_CREATE_FAILED">,
  number
> = {
  REFERENCE_URL_IMPORT_DISABLED: 400,
  REFERENCE_URL_PLATFORM_UNSUPPORTED: 400,
  REFERENCE_INVALID_URL: 400,
  REFERENCE_PLATFORM_UNSUPPORTED: 400,
  REFERENCE_PARSE_FAILED: 400,
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

    const parsed = parseReferenceUrlSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await parseReferenceUrlMetadata({
      projectId,
      teamId: session.teamId,
      sourceUrl: parsed.data.sourceUrl,
    });

    if (!result.success) {
      return referenceUrlImportErrorResponse(result.error.code, result.error.message, result.data);
    }

    return success(result.data, "参考链接 metadata 已解析");
  } catch (error) {
    console.error("Parse reference URL metadata error:", error);
    return internalError();
  }
}

function referenceUrlImportErrorResponse(
  code: ParseReferenceUrlMetadataErrorCode,
  message: string,
  data?: unknown
): NextResponse {
  if (code === "PROJECT_NOT_FOUND") {
    return notFound("项目不存在");
  }

  if (code === "REFERENCE_SOURCE_CREATE_FAILED") {
    return internalError(message);
  }

  return NextResponse.json(
    {
      code,
      message,
      ...(data ? { data } : {}),
    },
    { status: REFERENCE_URL_IMPORT_ERROR_STATUS[code] }
  );
}
