import {
  VOICE_CLONE_COSYVOICE_PROVIDER,
  VOICE_CLONE_GPT_SOVITS_PROVIDER,
  VOICE_CLONE_LOCAL_PROVIDER,
  VOICE_CLONE_LOCAL_TIMEOUT_MS,
  VOICE_CLONE_LOCAL_TRAIN_PATH,
  VOICE_CLONE_MOCK_PROVIDER,
  VOICE_SAMPLE_ERROR_CODES,
  VOICE_SAMPLE_ERROR_MESSAGES,
  type VoiceSampleErrorCode,
} from "@/lib/voice-clone/constants";

export type VoiceTrainerLogLevel = "info" | "warn" | "error";

export type VoiceTrainerLog = {
  level: VoiceTrainerLogLevel;
  message: string;
};

export type VoiceTrainerInput = {
  voiceCloneJobId: string;
  voiceSampleId: string;
  sampleAssetId: string;
  sampleFileName: string;
  sampleAudio: Buffer;
  traceId: string;
};

export type VoiceTrainerOutput = {
  provider: string;
  modelId: string;
  sampleUrl: string;
  logs: VoiceTrainerLog[];
  providerRequestId?: string;
};

export type LocalVoiceTrainerServiceConfig = {
  baseUrl: string | null;
  status: string;
  modelName?: string | null;
};

export interface VoiceTrainer {
  train(input: VoiceTrainerInput): Promise<VoiceTrainerOutput>;
}

export type VoiceTrainerTransport = typeof fetch;

export class VoiceTrainerError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "VoiceTrainerError";
  }
}

export function createMockVoiceTrainer(): VoiceTrainer {
  return {
    async train(input) {
      return {
        provider: VOICE_CLONE_MOCK_PROVIDER,
        modelId: `mock-${input.voiceCloneJobId}`,
        sampleUrl: `mock://voice-clone/${input.voiceCloneJobId}/sample.wav`,
        logs: [
          {
            level: "info",
            message: `mock voice trainer accepted ${input.sampleFileName}`,
          },
          {
            level: "info",
            message: `mock model generated for ${input.voiceSampleId}`,
          },
        ],
        providerRequestId: `mock-${input.traceId}`,
      };
    },
  };
}

export function createVoiceTrainer(
  provider: string,
  localService?: LocalVoiceTrainerServiceConfig | null
): VoiceTrainer {
  if (provider === VOICE_CLONE_MOCK_PROVIDER) {
    return createMockVoiceTrainer();
  }

  if (
    provider === VOICE_CLONE_LOCAL_PROVIDER ||
    provider === VOICE_CLONE_GPT_SOVITS_PROVIDER ||
    provider === VOICE_CLONE_COSYVOICE_PROVIDER
  ) {
    return createLocalVoiceTrainer(localService);
  }

  return createLocalVoiceTrainer(localService);
}

export function createLocalVoiceTrainer(
  service?: LocalVoiceTrainerServiceConfig | null,
  transport: VoiceTrainerTransport = fetch
): VoiceTrainer {
  return {
    async train(input) {
      if (!service?.baseUrl || service.status !== "online") {
        throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.trainerUnavailable);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), VOICE_CLONE_LOCAL_TIMEOUT_MS);

      try {
        const response = await transport(
          `${service.baseUrl.replace(/\/$/, "")}${VOICE_CLONE_LOCAL_TRAIN_PATH}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              voiceCloneJobId: input.voiceCloneJobId,
              voiceSampleId: input.voiceSampleId,
              sampleAssetId: input.sampleAssetId,
              sampleFileName: input.sampleFileName,
              sampleAudioBase64: input.sampleAudio.toString("base64"),
              traceId: input.traceId,
              modelName: service.modelName,
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.trainerUnavailable);
        }

        return normalizeLocalTrainerOutput(await response.json());
      } catch (error) {
        if (error instanceof VoiceTrainerError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.trainerUnavailable);
        }

        throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.trainerUnavailable);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function normalizeLocalTrainerOutput(value: unknown): VoiceTrainerOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.invalidTrainerOutput);
  }

  const data = value as {
    model_id?: unknown;
    sample_url?: unknown;
    logs?: unknown;
    provider_request_id?: unknown;
  };
  if (typeof data.model_id !== "string" || !data.model_id) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.invalidTrainerOutput);
  }
  if (typeof data.sample_url !== "string" || !data.sample_url) {
    throw voiceTrainerError(VOICE_SAMPLE_ERROR_CODES.invalidTrainerOutput);
  }

  return {
    provider: VOICE_CLONE_LOCAL_PROVIDER,
    modelId: data.model_id,
    sampleUrl: data.sample_url,
    logs: normalizeTrainerLogs(data.logs),
    ...(typeof data.provider_request_id === "string"
      ? { providerRequestId: data.provider_request_id }
      : {}),
  };
}

function normalizeTrainerLogs(value: unknown): VoiceTrainerLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const log = item as { level?: unknown; message?: unknown };
    if (typeof log.message !== "string") {
      return [];
    }

    return [
      {
        level: isTrainerLogLevel(log.level) ? log.level : "info",
        message: log.message,
      },
    ];
  });
}

function isTrainerLogLevel(value: unknown): value is VoiceTrainerLogLevel {
  return value === "info" || value === "warn" || value === "error";
}

function voiceTrainerError(code: VoiceSampleErrorCode) {
  return new VoiceTrainerError(code, VOICE_SAMPLE_ERROR_MESSAGES[code]);
}
