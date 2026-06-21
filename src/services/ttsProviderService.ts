import {
  TTS_ERROR_CODES,
  TTS_ERROR_MESSAGES,
  TTS_LOCAL_PROVIDER,
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

export function createTtsProvider(provider: string): TtsProvider {
  if (provider === TTS_MOCK_PROVIDER) {
    return createMockTtsProvider();
  }

  if (provider === TTS_LOCAL_PROVIDER) {
    return createUnavailableLocalTtsProvider();
  }

  return createUnavailableLocalTtsProvider();
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

function createUnavailableLocalTtsProvider(): TtsProvider {
  return {
    async synthesize() {
      throw new TtsProviderError(TTS_ERROR_CODES.TTS_PROVIDER_UNAVAILABLE);
    },
  };
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
