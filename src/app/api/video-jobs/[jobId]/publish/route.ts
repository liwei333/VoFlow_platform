import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import { PUBLISH_ERROR_CODES } from "@/lib/publish/publish";
import { PUBLISH_PLATFORMS } from "@/lib/publish/rules";
import { createPublishesForJob } from "@/services/publishService";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const createPublishesSchema = z.object({
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

  const parsed = createPublishesSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { jobId } = await context.params;

  try {
    const result = await createPublishesForJob({
      jobId,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
      platforms: parsed.data.platforms,
    });

    if (!result.success) {
      if (
        result.error.code === PUBLISH_ERROR_CODES.jobNotFound ||
        result.error.code === PUBLISH_ERROR_CODES.draftMissing
      ) {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data, "一键发布任务已创建");
  } catch (error) {
    console.error("Create publishes error:", error);
    return internalError();
  }
}
