import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { getChannelAccountsForUser } from "@/services/channelAccountService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const result = await getChannelAccountsForUser({
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
    });

    return success(result.data);
  } catch (error) {
    console.error("Get channel accounts error:", error);
    return internalError();
  }
}
