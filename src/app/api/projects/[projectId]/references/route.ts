import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { listReferenceSourcesForProject } from "@/services/referenceSourceService";

export async function GET(
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
    const result = await listReferenceSourcesForProject({
      projectId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return notFound(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("List reference sources error:", error);
    return internalError();
  }
}
