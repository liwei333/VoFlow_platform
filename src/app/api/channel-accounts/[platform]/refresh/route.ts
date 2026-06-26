import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { CHANNEL_OAUTH_ERROR_CODES } from "@/lib/publish/oauth";
import { refreshChannelAccountToken } from "@/services/channelOAuthService";

interface RouteContext {
  params: Promise<{ platform: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { platform } = await context.params;

  try {
    const result = await refreshChannelAccountToken({
      platform,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
    });

    if (!result.success) {
      if (
        result.error.code === CHANNEL_OAUTH_ERROR_CODES.tokenExpired ||
        result.error.code === CHANNEL_OAUTH_ERROR_CODES.refreshFailed ||
        result.error.code === "PUBLISH_PLATFORM_UNSUPPORTED"
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "渠道 token 已刷新");
  } catch (error) {
    console.error("Channel token refresh error:", error);
    return internalError();
  }
}
