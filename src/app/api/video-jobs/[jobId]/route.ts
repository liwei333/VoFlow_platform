import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { WORKFLOW_ERROR_MESSAGES } from "@/lib/workflow/errors";
import { getWorkflowJobDetail } from "@/services/workflowJobDetailService";

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
    const result = await getWorkflowJobDetail({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return notFound(WORKFLOW_ERROR_MESSAGES[result.error.code]);
    }

    return success({ job: result.data });
  } catch (error) {
    console.error("Get workflow job detail error:", error);
    return internalError();
  }
}
