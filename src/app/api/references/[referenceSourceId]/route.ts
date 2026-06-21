import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { getReferenceSourceForTeam } from "@/services/referenceSourceService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ referenceSourceId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { referenceSourceId } = await params;

  try {
    const result = await getReferenceSourceForTeam({
      referenceSourceId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return notFound(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("Get reference source error:", error);
    return internalError();
  }
}
