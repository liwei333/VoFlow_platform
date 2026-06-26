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
import { generatePublishDrafts } from "@/services/publishDraftGenerationService";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const generatePublishDraftsSchema = z.object({
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

  const parsed = generatePublishDraftsSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { jobId } = await context.params;

  try {
    const result = await generatePublishDrafts({
      jobId,
      teamId: auth.context.session.teamId,
      platforms: parsed.data.platforms,
    });

    if (!result.success) {
      if (result.error.code === "PUBLISH_JOB_NOT_FOUND") {
        return notFound(result.error.message);
      }

      if (
        result.error.code === "PUBLISH_SCRIPT_NOT_READY" ||
        result.error.code === "PUBLISH_PLATFORM_UNSUPPORTED"
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "发布草稿已生成");
  } catch (error) {
    console.error("Generate publish drafts error:", error);
    return internalError();
  }
}
