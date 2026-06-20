import { describe, expect, it, vi } from "vitest";
import {
  EXTERNAL_LLM_DISABLED,
  LOCAL_LLM_UNAVAILABLE,
  getScriptAiModelRegistry,
  requireAvailableLlmService,
} from "@/services/scriptModelRegistryService";

describe("script AI model registry", () => {
  it("reads llm and asr service endpoints from local_model_services records", async () => {
    const findScriptModelServices = vi.fn(async () => [
      {
        serviceType: "llm" as const,
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
        status: "online" as const,
      },
      {
        serviceType: "asr" as const,
        baseUrl: "http://localhost:6000",
        modelName: null,
        status: "busy" as const,
      },
    ]);

    await expect(
      getScriptAiModelRegistry({
        env: {
          LLM_PROVIDER: "local-openai-compatible",
          LLM_MAX_TOKENS: "1200",
          LLM_BASE_URL: "https://api.openai.example",
          LLM_MODEL: "online-model",
          LLM_TIMEOUT_MS: "9999",
        },
        repository: { findScriptModelServices },
      })
    ).resolves.toEqual({
      llm: {
        serviceType: "llm",
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
        status: "online",
      },
      asr: {
        serviceType: "asr",
        baseUrl: "http://localhost:6000",
        status: "busy",
      },
      generation: {
        provider: "local-openai-compatible",
        maxTokens: 1200,
      },
    });

    expect(findScriptModelServices).toHaveBeenCalledTimes(1);
  });

  it("defaults generation provider without requiring online model keys", async () => {
    await expect(
      getScriptAiModelRegistry({
        env: {},
        repository: {
          findScriptModelServices: async () => [],
        },
      })
    ).resolves.toMatchObject({
      llm: null,
      asr: null,
      generation: {
        provider: "local-openai-compatible",
      },
    });
  });

  it("does not read OpenAI or Claude keys when the provider defaults to local", async () => {
    const env = createEnvWithForbiddenOnlineKeys();

    await expect(
      getScriptAiModelRegistry({
        env,
        repository: {
          findScriptModelServices: async () => [],
        },
      })
    ).resolves.toMatchObject({
      generation: {
        provider: "local-openai-compatible",
      },
    });
  });

  it("rejects external llm providers unless explicitly enabled", async () => {
    await expect(
      getScriptAiModelRegistry({
        env: {
          LLM_PROVIDER: "openai",
          OPENAI_API_KEY: "should-not-be-needed",
        },
        repository: {
          findScriptModelServices: async () => [],
        },
      })
    ).rejects.toMatchObject({
      code: EXTERNAL_LLM_DISABLED,
      message: "外部 LLM provider 未启用",
    });
  });

  it("allows external llm providers only when ALLOW_EXTERNAL_LLM is true", async () => {
    await expect(
      getScriptAiModelRegistry({
        env: {
          LLM_PROVIDER: "openai",
          ALLOW_EXTERNAL_LLM: "true",
          LLM_MAX_TOKENS: "900",
        },
        repository: {
          findScriptModelServices: async () => [],
        },
      })
    ).resolves.toMatchObject({
      generation: {
        provider: "openai",
        externalProviderAllowed: true,
        maxTokens: 900,
      },
    });
  });

  it("maps unavailable llm registry status to LOCAL_LLM_UNAVAILABLE", () => {
    expect(() =>
      requireAvailableLlmService({
        serviceType: "llm",
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
        status: "offline",
      })
    ).toThrowError(
      expect.objectContaining({
        code: LOCAL_LLM_UNAVAILABLE,
        message: "本地 LLM 服务不可用",
      })
    );
  });

  it("returns llm baseUrl and modelName when the registry status is online", () => {
    expect(
      requireAvailableLlmService({
        serviceType: "llm",
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
        status: "online",
      })
    ).toEqual({
      baseUrl: "http://localhost:8000",
      modelName: "qwen-local",
    });
  });
});

function createEnvWithForbiddenOnlineKeys(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  Object.defineProperties(env, {
    OPENAI_API_KEY: {
      get() {
        throw new Error("OPENAI_API_KEY should not be read by default");
      },
    },
    CLAUDE_API_KEY: {
      get() {
        throw new Error("CLAUDE_API_KEY should not be read by default");
      },
    },
  });
  return env;
}
