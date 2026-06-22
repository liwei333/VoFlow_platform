import { describe, expect, it } from "vitest";
import {
  createLocalLegalReviewLlmReviewer,
  explainLegalRiskFindings,
} from "@/services/legalReviewLlmProvider";

describe("legal review LLM provider", () => {
  const findings = [
    {
      riskType: "exaggeration" as const,
      severity: "high" as const,
      originalText: "绝对第一",
      reason: "命中绝对化或极限化宣传表达，可能构成夸大宣传。",
      suggestion: "表现出色",
    },
  ];

  it("returns legal explanations and suggestions for risk findings", async () => {
    const result = await explainLegalRiskFindings({
      content: "这款产品绝对第一",
      findings,
    });

    expect(result).toEqual([
      expect.objectContaining({
        originalText: "绝对第一",
        reason: "命中绝对化或极限化宣传表达，可能构成夸大宣传。",
        suggestion: "表现出色",
      }),
    ]);
  });

  it("preserves rule findings when the reviewer provider fails", async () => {
    const result = await explainLegalRiskFindings(
      {
        content: "这款产品绝对第一",
        findings,
      },
      {
        review: async () => {
          throw new Error("llm unavailable");
        },
      }
    );

    expect(result).toEqual(findings);
  });

  it("calls a local OpenAI-compatible LLM reviewer and merges explanations", async () => {
    const fetcher = async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      originalText: "绝对第一",
                      reason: "LLM 解释的夸大宣传风险",
                      suggestion: "表现较好",
                    },
                  ],
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    const reviewer = createLocalLegalReviewLlmReviewer({
      service: {
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
      },
      fetcher,
    });

    await expect(
      explainLegalRiskFindings(
        {
          content: "这款产品绝对第一",
          findings,
        },
        reviewer
      )
    ).resolves.toEqual([
      {
        ...findings[0],
        reason: "LLM 解释的夸大宣传风险",
        suggestion: "表现较好",
      },
    ]);
  });
});
