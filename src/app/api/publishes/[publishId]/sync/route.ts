import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, notFound, success } from "@/lib/api-response";
import { PUBLISH_ERROR_CODES } from "@/lib/publish/publish";
import {
  PUBLISH_STATUS_SYNC_ERROR_CODES,
  syncPublishStatusForUser,
} from "@/services/publishStatusSyncService";

interface RouteContext {
  params: Promise<{ publishId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { publishId } = await context.params;

  try {
    const result = await syncPublishStatusForUser({
      publishId,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
    });

    if (!result.success) {
      if (result.error.code === PUBLISH_ERROR_CODES.publishNotFound) {
        return notFound(result.error.message);
      }

      if (result.error.code === PUBLISH_STATUS_SYNC_ERROR_CODES.statusSyncFailed) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "发布状态已同步");
  } catch (error) {
    console.error("Sync publish status error:", error);
    return internalError();
  }
}
