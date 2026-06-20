import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import {
  approveScriptCandidate,
  type ApproveScriptCandidateErrorCode,
} from "@/services/scriptCandidateApprovalService";

const approveScriptCandidateSchema = z.object({
  jobId: z.string().min(1),
  confirmRisk: z.boolean().optional().default(false),
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

    const parsed = approveScriptCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await approveScriptCandidate({
      candidateId,
      jobId: parsed.data.jobId,
      teamId: session.teamId,
      confirmRisk: parsed.data.confirmRisk,
    });

    if (!result.success) {
      return approveScriptCandidateErrorResponse(result.error.code);
    }

    return success(result.data, "候选文案已确认");
  } catch (error) {
    console.error("Approve script candidate error:", error);
    return internalError();
  }
}

function approveScriptCandidateErrorResponse(code: ApproveScriptCandidateErrorCode): NextResponse {
  if (code === "CANDIDATE_NOT_FOUND") {
    return notFound("候选文案不存在");
  }

  if (code === "VIDEO_JOB_NOT_FOUND") {
    return notFound("视频任务不存在");
  }

  return NextResponse.json(
    {
      code: "RISK_CONFIRMATION_REQUIRED",
      message: "风险命中候选文案必须显式确认",
    },
    { status: 409 }
  );
}
