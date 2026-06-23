import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { internalError, invalidJsonBody, success, validationError } from "@/lib/api-response";
import {
  VOICE_SAMPLE_API_MESSAGES,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
} from "@/lib/voice-clone/constants";
import {
  createVoiceCloneTrainingTask,
  type CreateVoiceCloneTrainingTaskResult,
} from "@/services/voiceCloneService";

const createVoiceCloneTaskSchema = z.object({
  jobId: z.string().trim().min(1),
  voiceSampleId: z.string().trim().min(1),
});

const VOICE_CLONE_BAD_REQUEST_CODES = new Set<string>([
  VOICE_SAMPLE_ERROR_CODES.consentRequired,
  VOICE_SAMPLE_ERROR_CODES.qualityNotPassed,
]);

const VOICE_CLONE_NOT_FOUND_CODES = new Set<string>([
  VOICE_SAMPLE_ERROR_CODES.notFound,
  VOICE_SAMPLE_ERROR_CODES.jobNotFound,
]);

export async function POST(request: NextRequest) {
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

  const parsed = createVoiceCloneTaskSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.errors);
  }

  const result = await createVoiceCloneTrainingTask({
    jobId: parsed.data.jobId,
    voiceSampleId: parsed.data.voiceSampleId,
    teamId: auth.context.session.teamId,
    userId: auth.context.session.userId,
  });

  if (!result.success) {
    return voiceCloneTaskErrorResponse(result);
  }

  return success(result.data, VOICE_SAMPLE_API_MESSAGES.cloneTaskSuccess);
}

function voiceCloneTaskErrorResponse(
  result: Extract<CreateVoiceCloneTrainingTaskResult, { success: false }>
): NextResponse {
  if (VOICE_CLONE_BAD_REQUEST_CODES.has(result.error.code)) {
    return NextResponse.json(result.error, { status: 400 });
  }

  if (VOICE_CLONE_NOT_FOUND_CODES.has(result.error.code)) {
    return NextResponse.json(result.error, { status: 404 });
  }

  return internalError(
    VOICE_SAMPLE_ERROR_MESSAGES[result.error.code] ?? result.error.message
  );
}
