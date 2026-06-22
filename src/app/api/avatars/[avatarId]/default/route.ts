import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { success } from "@/lib/api-response";
import { AVATAR_API_MESSAGES } from "@/lib/avatar/constants";
import { setDefaultAvatar } from "@/services/avatarService";

type RouteContext = {
  params: Promise<{
    avatarId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { avatarId } = await context.params;
  const result = await setDefaultAvatar({
    avatarId,
    teamId: auth.context.session.teamId,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: result.error.status }
    );
  }

  return success({ avatar: result.avatar }, AVATAR_API_MESSAGES.defaultSuccess);
}
