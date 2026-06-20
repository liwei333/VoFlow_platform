import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalOpenAiCompatibleLlmProvider } from "@/services/scriptLlmProvider";

describe("Local OpenAI-compatible LLM provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rewrites scripts through the supplied local llm service config", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://api.openai.example");
    vi.stubEnv("LLM_MODEL", "online-model");
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              candidates: ["第一版口播", "第二版口播", "第三版口播"],
            }),
          },
        },
      ],
    }));

    const provider = createLocalOpenAiCompatibleLlmProvider({
      service: {
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
      },
      fetcher,
    });

    await expect(
      provider.rewriteScript(
        {
          script: "这是一段原始文案",
          platform: "douyin",
          tone: "friendly",
          forbiddenWords: ["绝对"],
        },
        {
          candidateCount: 3,
          maxTokens: 800,
          temperature: 0.6,
        }
      )
    ).resolves.toEqual({
      provider: "local-openai-compatible",
      modelName: "qwen-local",
      candidates: ["第一版口播", "第二版口播", "第三版口播"],
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://localhost:8000/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "qwen-local",
      max_tokens: 800,
      temperature: 0.6,
    });
  });

  it("generates title candidates with the supplied platform", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse({
      choices: [
        {
          message: {
            content: JSON.stringify({
              titles: ["标题1", "标题2", "标题3", "标题4", "标题5"],
            }),
          },
        },
      ],
    }));
    const provider = createLocalOpenAiCompatibleLlmProvider({
      service: {
        baseUrl: "http://localhost:8000/",
        modelName: "qwen-local",
      },
      fetcher,
    });

    await expect(provider.generateTitles("这是一段口播文案", "douyin")).resolves.toEqual({
      provider: "local-openai-compatible",
      modelName: "qwen-local",
      titles: ["标题1", "标题2", "标题3", "标题4", "标题5"],
    });

    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.messages.at(-1).content).toContain("douyin");
  });

  it("checks local model availability without reading model env values", async () => {
    vi.stubEnv("LLM_MODEL", "online-model");
    const fetcher = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => jsonResponse({
      data: [
        { id: "qwen-local" },
      ],
    }));
    const provider = createLocalOpenAiCompatibleLlmProvider({
      service: {
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
      },
      fetcher,
      now: () => 1000,
    });

    await expect(provider.healthCheck()).resolves.toMatchObject({
      provider: "local-openai-compatible",
      modelName: "qwen-local",
      status: "online",
    });

    expect(fetcher).toHaveBeenCalledWith("http://localhost:8000/v1/models", expect.any(Object));
  });
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
