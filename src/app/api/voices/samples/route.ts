import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { success, validationError } from "@/lib/api-response";
import { serializeAsset } from "@/lib/assets/serializer";
import {
  VOICE_SAMPLE_API_MESSAGES,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
} from "@/lib/voice-clone/constants";
import {
  analyzeVoiceSampleQuality,
  getVoiceSampleQualityFailureCode,
} from "@/lib/voice-clone/quality";
import { serializeVoiceSample } from "@/lib/voice-clone/serializer";
import { createVoiceSampleFromUpload } from "@/services/voiceSampleService";

const durationMsSchema = z.coerce.number().int().positive();
const qualityMetricSchema = z.coerce.number().refine(Number.isFinite);

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const durationMsValue = formData.get("durationMs");
    const averageVolumeDbValue = formData.get("averageVolumeDb");
    const silenceRatioValue = formData.get("silenceRatio");
    const noiseLevelValue = formData.get("noiseLevel");

    if (!file) {
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: VOICE_SAMPLE_API_MESSAGES.missingFile,
          errorCode: "EMPTY_FILE",
        },
        { status: 400 }
      );
    }

    const parsedDuration = parseDurationMs(durationMsValue);
    if (!parsedDuration.success) {
      return validationError(
        parsedDuration.errors,
        VOICE_SAMPLE_ERROR_MESSAGES[VOICE_SAMPLE_ERROR_CODES.durationInvalid]
      );
    }

    const parsedQualityMetrics = parseQualityMetrics({
      averageVolumeDb: averageVolumeDbValue,
      silenceRatio: silenceRatioValue,
      noiseLevel: noiseLevelValue,
    });
    if (!parsedQualityMetrics.success) {
      return validationError(
        parsedQualityMetrics.errors,
        VOICE_SAMPLE_ERROR_MESSAGES[VOICE_SAMPLE_ERROR_CODES.qualityMetricInvalid]
      );
    }

    const qualityReport = analyzeVoiceSampleQuality({
      durationMs: parsedDuration.value,
      ...parsedQualityMetrics.value,
    });
    if (!qualityReport.passed) {
      const errorCode = getVoiceSampleQualityFailureCode(qualityReport);
      return NextResponse.json(
        {
          code: errorCode,
          message: VOICE_SAMPLE_ERROR_MESSAGES[errorCode],
          data: { qualityReport },
        },
        { status: 400 }
      );
    }

    const result = await createVoiceSampleFromUpload({
      teamId: auth.context.session.teamId,
      userId: auth.context.session.userId,
      file,
      name,
      durationMs: parsedDuration.value,
      qualityReport,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          code: result.error.code,
          message: result.error.message,
          ...(result.error.errorCode ? { errorCode: result.error.errorCode } : {}),
        },
        { status: result.error.status }
      );
    }

    const asset = await serializeAsset(result.asset, {
      onAccessUrlError: (error) => {
        console.error("Failed to generate voice sample URL:", error);
      },
    });

    return success(
      {
        voiceSample: serializeVoiceSample(result.related, asset),
      },
      VOICE_SAMPLE_API_MESSAGES.uploadSuccess
    );
  } catch (error) {
    console.error("Voice sample upload error:", error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: VOICE_SAMPLE_API_MESSAGES.internalError,
      },
      { status: 500 }
    );
  }
}

function parseDurationMs(value: FormDataEntryValue | null):
  | { success: true; value: number }
  | { success: false; errors: unknown } {
  if (typeof value !== "string" || !value.trim()) {
    return {
      success: false,
      errors: [{ path: ["durationMs"], message: "Required" }],
    };
  }

  const parsed = durationMsSchema.safeParse(value);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.errors };
  }

  return { success: true, value: parsed.data };
}

function parseQualityMetrics(values: {
  averageVolumeDb: FormDataEntryValue | null;
  silenceRatio: FormDataEntryValue | null;
  noiseLevel: FormDataEntryValue | null;
}):
  | {
      success: true;
      value: {
        averageVolumeDb?: number;
        silenceRatio?: number;
        noiseLevel?: number;
      };
    }
  | { success: false; errors: unknown } {
  const parsed: {
    averageVolumeDb?: number;
    silenceRatio?: number;
    noiseLevel?: number;
  } = {};
  const errors: unknown[] = [];

  for (const [field, value] of Object.entries(values)) {
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    const result = qualityMetricSchema.safeParse(value);
    if (!result.success) {
      errors.push(...result.error.errors.map((error) => ({ ...error, path: [field] })));
      continue;
    }

    parsed[field as keyof typeof parsed] = result.data;
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, value: parsed };
}
