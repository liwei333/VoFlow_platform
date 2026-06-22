import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, success, validationError } from "@/lib/api-response";
import { legalReviewErrorResponse } from "@/lib/legal-review/api";
import { LEGAL_RISK_RESOLVE_ACTION_VALUES } from "@/lib/legal-review/constants";
import { resolveLegalRiskItem } from "@/services/legalReviewService";

const resolveRiskItemSchema = z.object({
  action: z.enum(LEGAL_RISK_RESOLVE_ACTION_VALUES),
  ignoredReason: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { itemId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = resolveRiskItemSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await resolveLegalRiskItem({
      riskItemId: itemId,
      teamId: session.teamId,
      userId: session.userId,
      action: parsed.data.action,
      ignoredReason: parsed.data.ignoredReason,
    });

    if (!result.success) {
      return legalReviewErrorResponse(result.error);
    }

    return success(result.data, "风险项已处理");
  } catch (error) {
    console.error("Resolve legal risk item error:", error);
    return internalError();
  }
}
