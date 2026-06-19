import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  internalError,
  invalidJsonBody,
  notFound,
  success,
  validationError,
} from "@/lib/api-response";
import {
  assetConsentRequestSchema,
  confirmAssetConsent,
} from "@/lib/assets/consent";

function getRequestIpAddress(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || undefined;
  }

  return request.headers.get("x-real-ip") ?? undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { assetId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = assetConsentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await confirmAssetConsent({
      ...parsed.data,
      assetId,
      teamId: session.teamId,
      userId: session.userId,
      ipAddress: getRequestIpAddress(request),
    });

    if (!result) {
      return notFound();
    }

    return success(result);
  } catch (error) {
    console.error("Confirm asset consent error:", error);
    return internalError();
  }
}
