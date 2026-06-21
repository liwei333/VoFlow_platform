import { describe, expect, it } from "vitest";
import { createMockTtsProvider, inspectTtsAudio } from "@/services/ttsProviderService";

describe("TTS provider service", () => {
  it("synthesizes deterministic mock audio with metadata", async () => {
    const provider = createMockTtsProvider();

    const result = await provider.synthesize({
      text: "这是一段用于生成语音的口播文案",
      voice: {
        id: "voice-1",
        name: "清亮女声",
        provider: "mock",
        modelId: "preset-clear-female",
      },
      params: {
        speed: 1,
        pitch: 0,
      },
    });

    expect(result.audioBuffer.length).toBeGreaterThan(0);
    expect(result.contentType).toBe("audio/wav");
    expect(result.fileExtension).toBe("wav");
    expect(result.metadata).toMatchObject({
      durationMs: expect.any(Number),
      sampleRate: 16000,
      format: "wav",
    });
  });

  it("rejects empty provider output as invalid audio", () => {
    expect(() =>
      inspectTtsAudio({
        audioBuffer: Buffer.alloc(0),
        contentType: "audio/wav",
        fileExtension: "wav",
        metadata: {},
      })
    ).toThrow("TTS_INVALID_AUDIO_OUTPUT");
  });
});
