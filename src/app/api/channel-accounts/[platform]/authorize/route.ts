import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { getChannelAuthorizationEntry } from "@/services/channelOAuthService";

interface RouteContext {
  params: Promise<{ platform: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { platform } = await context.params;

  try {
    const result = getChannelAuthorizationEntry({
      platform,
    });

    if (!result.success) {
      if (result.error.code === "PUBLISH_PLATFORM_UNSUPPORTED") {
        return NextResponse.json(result.error, { status: 400 });
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("Get channel authorization entry error:", error);
    return internalError();
  }
}
