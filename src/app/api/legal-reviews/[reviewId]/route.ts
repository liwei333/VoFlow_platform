import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { internalError, success } from "@/lib/api-response";
import { legalReviewErrorResponse } from "@/lib/legal-review/api";
import { getLegalReview } from "@/services/legalReviewService";

export async function GET(
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
    const result = await getLegalReview(reviewId, session.teamId);

    if (!result.success) {
      return legalReviewErrorResponse(result.error);
    }

    return success(result.data);
  } catch (error) {
    console.error("Get legal review error:", error);
    return internalError();
  }
}
