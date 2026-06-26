import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { PUBLISH_DRAFT_ERROR_CODES } from "@/services/publishDraftService";
import { getPublishDraftsForJob } from "@/services/publishDraftService";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { jobId } = await context.params;

  try {
    const result = await getPublishDraftsForJob({
      jobId,
      teamId: auth.context.session.teamId,
    });

    if (!result.success) {
      if (result.error.code === PUBLISH_DRAFT_ERROR_CODES.jobNotFound) {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("Get publish drafts error:", error);
    return internalError();
  }
}
