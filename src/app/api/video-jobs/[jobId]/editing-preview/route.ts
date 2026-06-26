import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { EDITING_ERROR_CODES } from "@/lib/editing/constants";
import { createEditingPreviewTask } from "@/services/editingPreviewTaskService";

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
    const result = await createEditingPreviewTask({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      if (result.error.code === EDITING_ERROR_CODES.jobNotFound) {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data, "剪辑预览任务已创建");
  } catch (error) {
    console.error("Create editing preview task error:", error);
    return internalError();
  }
}
