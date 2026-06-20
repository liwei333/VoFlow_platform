import { describe, expect, it, vi } from "vitest";
import { syncLocalModelServicesFromEnv } from "@/services/localModelService";

describe("Local model service registry", () => {
  it("upserts service registry entries from environment configuration", async () => {
    const upsertLocalModelService = vi.fn().mockImplementation(async (service) => service);

    await syncLocalModelServicesFromEnv(
      {
        LLM_BASE_URL: "http://localhost:8000",
        LLM_MODEL: "qwen",
        TTS_BASE_URL: "http://localhost:5000",
        ASR_BASE_URL: "http://localhost:6000",
        AVATAR_BASE_URL: "http://localhost:7000",
        FFMPEG_WORKER: "/usr/local/bin/ffmpeg",
      },
      { upsertLocalModelService }
    );

    expect(upsertLocalModelService).toHaveBeenCalledTimes(5);
    expect(upsertLocalModelService).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "llm",
        name: "本地 LLM",
        baseUrl: "http://localhost:8000",
        modelName: "qwen",
        status: "offline",
      })
    );
    expect(upsertLocalModelService).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ffmpeg",
        baseUrl: "/usr/local/bin/ffmpeg",
      })
    );
  });
});
