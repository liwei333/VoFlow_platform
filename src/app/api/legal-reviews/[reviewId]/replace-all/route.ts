import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { legalReviewErrorResponse } from "@/lib/legal-review/api";
import { replaceAllLegalRiskItems } from "@/services/legalReviewService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { reviewId } = await params;

  try {
    const result = await replaceAllLegalRiskItems({
      reviewId,
      teamId: session.teamId,
    });

    if (!result.success) {
      return legalReviewErrorResponse(result.error);
    }

    return success(result.data, "风险项已替换");
  } catch (error) {
    console.error("Replace legal risk items error:", error);
    return internalError();
  }
}
