import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  success,
  validationError,
} from "@/lib/api-response";
import { MOCK_CHANNEL_AUTH_LIMITS } from "@/lib/publish/oauth";
import { mockAuthorizeChannelAccount } from "@/services/channelOAuthService";

interface RouteContext {
  params: Promise<{ platform: string }>;
}

const mockAuthorizeSchema = z.object({
  accountName: z.string().trim().min(1).max(80).optional(),
  expiresInDays: z
    .number()
    .int()
    .min(MOCK_CHANNEL_AUTH_LIMITS.minExpiresInDays)
    .max(MOCK_CHANNEL_AUTH_LIMITS.maxExpiresInDays)
    .optional(),
});

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

  const parsed = mockAuthorizeSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { platform } = await context.params;

  try {
    const result = await mockAuthorizeChannelAccount({
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
      platform,
      accountName: parsed.data.accountName,
      expiresInDays: parsed.data.expiresInDays,
    });

    if (!result.success) {
      if (result.error.code === "PUBLISH_PLATFORM_UNSUPPORTED") {
        return NextResponse.json(result.error, { status: 400 });
      }

      if (result.error.code === "CHANNEL_TOKEN_SECRET_MISSING") {
        return NextResponse.json(
          {
            code: result.error.code,
            message: "渠道授权配置缺失",
          },
          { status: 500 }
        );
      }

      return internalError(result.error.message);
    }

    return success(result.data, "渠道账号已授权");
  } catch (error) {
    console.error("Mock authorize channel account error:", error);
    return internalError();
  }
}
