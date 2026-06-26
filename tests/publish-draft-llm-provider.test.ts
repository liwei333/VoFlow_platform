import { describe, expect, it, vi } from "vitest";
import { getPublishPlatformRule } from "@/lib/publish/rules";
import { createLocalPublishDraftLlmProvider } from "@/services/publishDraftLlmProvider";

describe("local publish draft llm provider", () => {
  it("posts an OpenAI-compatible chat request and parses fenced JSON draft output", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: [
                "```json",
                JSON.stringify({
                  title: "短视频标题",
                  description: "发布描述",
                  tags: ["tag1", "tag2"],
                  topics: ["topic1"],
                }),
                "```",
              ].join("\n"),
            },
          },
        ],
      })
    );
    const provider = createLocalPublishDraftLlmProvider({
      service: {
        baseUrl: "http://localhost:8000/",
        modelName: "qwen-local",
      },
      fetcher,
    });

    await expect(
      provider.generateDraft(
        {
          script: "最终文案",
          platform: "douyin",
          platformLabel: "抖音",
          rule: getPublishPlatformRule("douyin"),
        },
        {
          maxTokens: 800,
          traceId: "trace-provider",
        }
      )
    ).resolves.toEqual({
      modelName: "qwen-local",
      title: "短视频标题",
      description: "发布描述",
      tags: ["tag1", "tag2"],
      topics: ["topic1"],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Trace-Id": "trace-provider",
        }),
        body: expect.stringContaining('"max_tokens":800'),
      })
    );
  });
});
