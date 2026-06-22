import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, notFound, success, validationError } from "@/lib/api-response";
import { TTS_ERROR_CODES, TTS_ERROR_MESSAGES, type TtsErrorCode } from "@/lib/tts/constants";
import { ttsParamsSchema } from "@/lib/tts/validation";
import {
  createTtsWorkflowTask,
  type CreateTtsWorkflowTaskResult,
} from "@/services/ttsService";
import { listTtsResultsForJob } from "@/services/ttsResultService";

const createTtsSchema = z.object({
  scriptCandidateId: z.string().min(1),
  voiceId: z.string().min(1),
  params: ttsParamsSchema.partial().optional().default({}),
});

const TTS_BAD_REQUEST_CODES: Set<TtsErrorCode> = new Set([
  TTS_ERROR_CODES.VOICE_NOT_FOUND,
  TTS_ERROR_CODES.VOICE_LICENSE_NOT_APPROVED,
  TTS_ERROR_CODES.TTS_SCRIPT_TOO_LONG,
  TTS_ERROR_CODES.TTS_PARAMS_INVALID,
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { jobId } = await params;

  try {
    const result = await listTtsResultsForJob({
      jobId,
      teamId: session.teamId,
    });

    if (!result.success) {
      if (result.error.code === "TTS_JOB_NOT_FOUND") {
        return notFound(result.error.message);
      }

      return internalError(result.error.message);
    }

    return success(result.data);
  } catch (error) {
    console.error("List TTS results error:", error);
    return internalError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  const { session } = auth.context;
  const { jobId } = await params;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonBody();
    }

    const parsed = createTtsSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.errors);
    }

    const result = await createTtsWorkflowTask({
      jobId,
      teamId: session.teamId,
      userId: session.userId,
      scriptCandidateId: parsed.data.scriptCandidateId,
      voiceId: parsed.data.voiceId,
      params: parsed.data.params,
    });

    if (!result.success) {
      return ttsTaskErrorResponse(result);
    }

    return success(result.data, "TTS 任务已创建");
  } catch (error) {
    console.error("Create TTS task error:", error);
    return internalError();
  }
}

function ttsTaskErrorResponse(
  result: Extract<CreateTtsWorkflowTaskResult, { success: false }>
): NextResponse {
  if (TTS_BAD_REQUEST_CODES.has(result.error.code)) {
    return NextResponse.json(result.error, { status: 400 });
  }

  return internalError(TTS_ERROR_MESSAGES[result.error.code] ?? result.error.message);
}
