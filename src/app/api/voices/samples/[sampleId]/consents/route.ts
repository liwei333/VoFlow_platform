import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { invalidJsonBody, success, validationError } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import { getRequestIpAddress } from "@/lib/request";
import { VOICE_SAMPLE_API_MESSAGES } from "@/lib/voice-clone/constants";
import {
  serializeVoiceConsent,
  serializeVoiceSample,
} from "@/lib/voice-clone/serializer";
import {
  confirmVoiceSampleConsent,
  voiceConsentRequestSchema,
} from "@/services/voiceSampleService";

type RouteContext = {
  params: Promise<{
    sampleId: string;
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

  const parsed = voiceConsentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.errors);
  }

  const { sampleId } = await context.params;
  const result = await confirmVoiceSampleConsent({
    voiceSampleId: sampleId,
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

  const asset = await serializeAsset(result.voiceSample.asset, {
    onAccessUrlError: (error) => {
      console.error("Failed to generate voice sample URL:", error);
    },
  });

  return success(
    {
      voiceSample: serializeVoiceSample(result.voiceSample, asset),
      consent: serializeVoiceConsent(result.consent),
    },
    VOICE_SAMPLE_API_MESSAGES.consentSuccess
  );
}
