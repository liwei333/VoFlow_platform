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
import { PUBLISH_PLATFORMS } from "@/lib/publish/rules";
import { PUBLISH_VALIDATION_ERROR_CODES } from "@/lib/publish/validation";
import { validatePublishParameters } from "@/services/publishValidationService";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const validatePublishSchema = z.object({
  platforms: z.array(z.enum(PUBLISH_PLATFORMS)).min(1).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = validatePublishSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { jobId } = await context.params;

  try {
    const result = await validatePublishParameters({
      jobId,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
      platforms: parsed.data.platforms,
    });

    if (!result.success) {
      if (result.error.code === PUBLISH_VALIDATION_ERROR_CODES.jobNotFound) {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    if (!result.data.summary.canPublish) {
      return NextResponse.json(
        {
          code: PUBLISH_VALIDATION_ERROR_CODES.validationFailed,
          message: "发布参数检查未通过",
          data: result.data,
        },
        { status: 400 }
      );
    }

    return success(result.data, "发布参数检查已通过");
  } catch (error) {
    console.error("Validate publish parameters error:", error);
    return internalError();
  }
}
