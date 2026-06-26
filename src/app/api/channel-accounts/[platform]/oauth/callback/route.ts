import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { CHANNEL_OAUTH_ERROR_CODES } from "@/lib/publish/oauth";
import { handleChannelOAuthCallback } from "@/services/channelOAuthService";

interface RouteContext {
  params: Promise<{ platform: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { platform } = await context.params;
  const searchParams = request.nextUrl.searchParams;

  try {
    const result = await handleChannelOAuthCallback({
      platform,
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
      code: searchParams.get("code"),
      state: searchParams.get("state"),
      error: searchParams.get("error"),
    });

    if (!result.success) {
      if (
        result.error.code === CHANNEL_OAUTH_ERROR_CODES.stateInvalid ||
        result.error.code === CHANNEL_OAUTH_ERROR_CODES.exchangeFailed ||
        result.error.code === "PUBLISH_PLATFORM_UNSUPPORTED"
      ) {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data, "渠道账号已授权");
  } catch (error) {
    console.error("Channel OAuth callback error:", error);
    return internalError();
  }
}
