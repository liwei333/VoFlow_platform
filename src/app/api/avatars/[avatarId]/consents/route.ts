import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { invalidJsonBody, success, validationError } from "@/lib/api-response";
import { AVATAR_API_MESSAGES } from "@/lib/avatar/constants";
import { getRequestIpAddress } from "@/lib/request";
import {
  avatarConsentRequestSchema,
  confirmAvatarConsent,
} from "@/services/avatarService";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidJsonBody();
  }

  const parsed = avatarConsentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.errors);
  }

  const { avatarId } = await context.params;
  const result = await confirmAvatarConsent({
    avatarId,
    ...parsed.data,
    teamId: auth.context.session.teamId,
    userId: auth.context.session.userId,
    ipAddress: getRequestIpAddress(request),
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

  return success({ avatar: result.avatar }, AVATAR_API_MESSAGES.consentSuccess);
}
