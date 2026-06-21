import {
  TTS_ERROR_CODES,
  TTS_ERROR_MESSAGES,
  TTS_LOCAL_PROVIDER,
  TTS_LOCAL_SYNTHESIZE_PATH,
  TTS_LOCAL_TIMEOUT_MS,
  TTS_MOCK_SAMPLE_RATE,
  TTS_MOCK_PROVIDER,
  type TtsErrorCode,
} from "@/lib/tts/constants";
import type { TtsParams } from "@/lib/tts/validation";

export type TtsProviderVoice = {
  id: string;
  name: string;
  provider: string;
  modelId: string;
};

export type TtsProviderInput = {
  text: string;
  voice: TtsProviderVoice;
  params: TtsParams;
};

export type TtsProviderOutput = {
  audioBuffer: Buffer;
  contentType: string;
  fileExtension: string;
  metadata: {
    durationMs?: number;
    sampleRate?: number;
    format?: string;
    [key: string]: unknown;
  };
  providerRequestId?: string;
};

export interface TtsProvider {
  synthesize(input: TtsProviderInput): Promise<TtsProviderOutput>;
}

export type LocalTtsServiceConfig = {
  baseUrl: string | null;
  status: string;
  modelName?: string | null;
};

export type TtsProviderTransport = typeof fetch;

export class TtsProviderError extends Error {
  constructor(public readonly code: TtsErrorCode, message = TTS_ERROR_MESSAGES[code]) {
    super(`${code}: ${message}`);
    this.name = "TtsProviderError";
  }
}

export function createMockTtsProvider(): TtsProvider {
  return {
    async synthesize(input) {
      const durationMs = Math.max(1000, Math.round((input.text.length / 4) * 1000));
      const audioBuffer = buildMockWavBuffer(durationMs);

      return {
        audioBuffer,
        contentType: "audio/wav",
        fileExtension: "wav",
        metadata: {
          durationMs,
          sampleRate: TTS_MOCK_SAMPLE_RATE,
          format: "wav",
          mocked: true,
          voiceId: input.voice.id,
          speed: input.params.speed,
          pitch: input.params.pitch,
        },
        providerRequestId: `mock-${input.voice.modelId}`,
      };
    },
  };
}

export function createTtsProvider(
  provider: string,
  localService?: LocalTtsServiceConfig | null
): TtsProvider {
  if (provider === TTS_MOCK_PROVIDER) {
    return createMockTtsProvider();
  }

  if (provider === TTS_LOCAL_PROVIDER) {
    return createLocalTtsProvider(localService);
  }

  return createLocalTtsProvider(localService);
}

export function inspectTtsAudio(output: TtsProviderOutput): TtsProviderOutput {
  if (!output.audioBuffer || output.audioBuffer.length === 0) {
    throw new TtsProviderError(TTS_ERROR_CODES.TTS_INVALID_AUDIO_OUTPUT);
  }

  if (!output.contentType.startsWith("audio/")) {
    throw new TtsProviderError(TTS_ERROR_CODES.TTS_INVALID_AUDIO_OUTPUT);
  }

  return output;
}

export function createLocalTtsProvider(
  service?: LocalTtsServiceConfig | null,
  transport: TtsProviderTransport = fetch
): TtsProvider {
  return {
    async synthesize(input) {
      if (!service?.baseUrl || service.status !== "online") {
        throw new TtsProviderError(TTS_ERROR_CODES.TTS_PROVIDER_UNAVAILABLE);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TTS_LOCAL_TIMEOUT_MS);

      try {
        const response = await transport(
          `${service.baseUrl.replace(/\/$/, "")}${TTS_LOCAL_SYNTHESIZE_PATH}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: input.text,
              voice: input.voice,
              params: input.params,
              modelName: service.modelName,
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new TtsProviderError(TTS_ERROR_CODES.TTS_PROVIDER_UNAVAILABLE);
        }

        const contentType = response.headers.get("content-type") || "audio/wav";
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        return {
          audioBuffer,
          contentType,
          fileExtension: getAudioFileExtension(contentType),
          metadata: {
            durationMs: Number(response.headers.get("x-audio-duration-ms")) || undefined,
            sampleRate: Number(response.headers.get("x-audio-sample-rate")) || undefined,
            format: getAudioFileExtension(contentType),
            provider: TTS_LOCAL_PROVIDER,
            voiceId: input.voice.id,
            speed: input.params.speed,
            pitch: input.params.pitch,
          },
          providerRequestId: response.headers.get("x-provider-request-id") || undefined,
        };
      } catch (error) {
        if (error instanceof TtsProviderError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new TtsProviderError(TTS_ERROR_CODES.TTS_TIMEOUT);
        }

        throw new TtsProviderError(TTS_ERROR_CODES.TTS_PROVIDER_UNAVAILABLE);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function getAudioFileExtension(contentType: string): string {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) {
    return "mp3";
  }

  if (contentType.includes("ogg")) {
    return "ogg";
  }

  if (contentType.includes("flac")) {
    return "flac";
  }

  return "wav";
}

function buildMockWavBuffer(durationMs: number): Buffer {
  const sampleCount = Math.max(1, Math.round((durationMs / 1000) * TTS_MOCK_SAMPLE_RATE));
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(TTS_MOCK_SAMPLE_RATE, 24);
  buffer.writeUInt32LE(TTS_MOCK_SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
