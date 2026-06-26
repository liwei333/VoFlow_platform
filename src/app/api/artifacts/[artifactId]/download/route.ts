import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { createFinalVideoDownloadUrl } from "@/services/exportDownloadService";

interface RouteContext {
  params: Promise<{ artifactId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { artifactId } = await context.params;

  try {
    const result = await createFinalVideoDownloadUrl({
      artifactId,
      teamId: auth.context.session.teamId,
      userId: auth.context.user.id,
    });

    if (!result.success) {
      return notFound(result.error.message);
    }

    return success(result.data, "下载链接已生成");
  } catch (error) {
    console.error("Create final video download URL error:", error);
    return internalError();
  }
}
