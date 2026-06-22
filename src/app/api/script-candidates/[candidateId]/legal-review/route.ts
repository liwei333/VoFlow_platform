import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, success, validationError } from "@/lib/api-response";
import { legalReviewErrorResponse } from "@/lib/legal-review/api";
import { createLegalReviewForCandidate } from "@/services/legalReviewService";

const createLegalReviewSchema = z.object({
  jobId: z.string().min(1).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { candidateId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = createLegalReviewSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createLegalReviewForCandidate({
      candidateId,
      jobId: parsed.data.jobId,
      teamId: session.teamId,
      userId: session.userId,
    });

    if (!result.success) {
      return legalReviewErrorResponse(result.error);
    }

    return success(result.data, "法务审查已完成");
  } catch (error) {
    console.error("Create legal review error:", error);
    return internalError();
  }
}
