import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { workflowActionErrorResponse } from "@/lib/workflow/api-response";
import { cancelWorkflowJob } from "@/services/workflowActionsService";

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
    const result = await cancelWorkflowJob({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return workflowActionErrorResponse(result.error);
    }

    return success(result.data);
  } catch (error) {
    console.error("Cancel workflow job error:", error);
    return internalError();
  }
}
