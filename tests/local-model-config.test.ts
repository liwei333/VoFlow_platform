import { describe, expect, it } from "vitest";
import {
  LOCAL_MODEL_ENV_EXAMPLES,
  LOCAL_MODEL_SERVICE_DEFINITIONS,
  buildLocalModelServiceConfigs,
} from "@/lib/local-model/config";

describe("Local model configuration", () => {
  it("declares the five MVP local service types", () => {
    expect(LOCAL_MODEL_SERVICE_DEFINITIONS.map((service) => service.type)).toEqual([
      "llm",
      "asr",
      "tts",
      "avatar",
      "ffmpeg",
    ]);
  });

  it("exposes the required environment variable examples", () => {
    expect(LOCAL_MODEL_ENV_EXAMPLES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "LLM_BASE_URL" }),
        expect.objectContaining({ key: "LLM_MODEL" }),
        expect.objectContaining({ key: "ASR_BASE_URL" }),
        expect.objectContaining({ key: "TTS_BASE_URL" }),
        expect.objectContaining({ key: "AVATAR_BASE_URL" }),
        expect.objectContaining({ key: "FFMPEG_WORKER" }),
        expect.objectContaining({ key: "GPU_MODE" }),
        expect.objectContaining({ key: "QUEUE_REDIS_URL" }),
      ])
    );
  });

  it("maps configured env values into service registry entries", () => {
    const configs = buildLocalModelServiceConfigs({
      LLM_BASE_URL: "http://localhost:8000",
      LLM_MODEL: "qwen2.5",
      ASR_BASE_URL: "http://localhost:6000",
      TTS_BASE_URL: "http://localhost:5000",
      AVATAR_BASE_URL: "http://localhost:7000",
      FFMPEG_WORKER: "/opt/bin/ffmpeg",
    });

    expect(configs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "llm",
          baseUrl: "http://localhost:8000",
          modelName: "qwen2.5",
          status: "offline",
        }),
        expect.objectContaining({
          type: "ffmpeg",
          baseUrl: "/opt/bin/ffmpeg",
          status: "offline",
        }),
      ])
    );
  });

  it("marks missing service configuration as misconfigured", () => {
    const configs = buildLocalModelServiceConfigs({});

    expect(configs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "llm",
          status: "misconfigured",
          lastError: expect.objectContaining({
            errorCode: "LOCAL_SERVICE_MISCONFIGURED",
          }),
        }),
        expect.objectContaining({
          type: "ffmpeg",
          status: "misconfigured",
          lastError: expect.objectContaining({
            errorCode: "LOCAL_SERVICE_MISCONFIGURED",
          }),
        }),
      ])
    );
  });
});
