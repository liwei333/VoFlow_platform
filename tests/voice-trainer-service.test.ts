import { describe, expect, it, vi } from "vitest";
import {
  createLocalVoiceTrainer,
  createMockVoiceTrainer,
  VoiceTrainerError,
} from "@/services/voiceTrainerService";

const trainerInput = {
  voiceCloneJobId: "clone-job-1",
  voiceSampleId: "sample-1",
  sampleAssetId: "asset-1",
  sampleFileName: "voice.wav",
  sampleAudio: Buffer.from("voice audio"),
  traceId: "trace-voice-trainer",
};

describe("voice trainer providers", () => {
  it("returns model id, sample url, and training logs from the mock trainer", async () => {
    const trainer = createMockVoiceTrainer();

    const output = await trainer.train(trainerInput);

    expect(output).toMatchObject({
      provider: "mock",
      modelId: "mock-clone-job-1",
      sampleUrl: "mock://voice-clone/clone-job-1/sample.wav",
      logs: expect.arrayContaining([
        expect.objectContaining({ level: "info", message: expect.stringContaining("mock") }),
      ]),
    });
  });

  it("posts training input to a local GPT-SoVITS/CosyVoice compatible trainer", async () => {
    const transport = vi.fn(async () =>
      new Response(
        JSON.stringify({
          model_id: "gpt-sovits-model-1",
          sample_url: "http://localhost:7011/samples/model-1.wav",
          logs: [{ level: "info", message: "training finished" }],
          provider_request_id: "provider-request-1",
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    const trainer = createLocalVoiceTrainer(
      {
        baseUrl: "http://localhost:7011",
        status: "online",
        modelName: "gpt-sovits",
      },
      transport
    );

    const output = await trainer.train(trainerInput);

    expect(transport).toHaveBeenCalledWith(
      "http://localhost:7011/voice-clone/train",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(JSON.parse(transport.mock.calls[0][1].body as string)).toMatchObject({
      voiceCloneJobId: "clone-job-1",
      voiceSampleId: "sample-1",
      sampleAssetId: "asset-1",
      sampleFileName: "voice.wav",
      modelName: "gpt-sovits",
    });
    expect(output).toMatchObject({
      provider: "local",
      modelId: "gpt-sovits-model-1",
      sampleUrl: "http://localhost:7011/samples/model-1.wav",
      providerRequestId: "provider-request-1",
      logs: [{ level: "info", message: "training finished" }],
    });
  });

  it("throws a provider error when the local trainer is unavailable", async () => {
    const trainer = createLocalVoiceTrainer({
      baseUrl: null,
      status: "misconfigured",
      modelName: "cosyvoice",
    });

    await expect(trainer.train(trainerInput)).rejects.toMatchObject({
      code: "VOICE_CLONE_TRAINER_UNAVAILABLE",
    } satisfies Partial<VoiceTrainerError>);
  });
});
