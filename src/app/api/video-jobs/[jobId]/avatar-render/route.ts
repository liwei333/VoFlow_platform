import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { listAvatarRenderResultsForJob } from "@/services/avatarRenderResultService";

export async function GET(
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
    const result = await listAvatarRenderResultsForJob({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      if (result.error.code === "AVATAR_RENDER_JOB_NOT_FOUND") {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("List avatar render results error:", error);
    return internalError();
  }
}
