import { describe, expect, it } from "vitest";
import { buildScriptRiskReport } from "@/lib/scripts/riskChecker";

describe("script risk checker", () => {
  it("builds a structured report with sensitive words, copyright, and factual review prompts", () => {
    const report = buildScriptRiskReport("这款产品绝对第一。");

    expect(report).toMatchObject({
      reportType: "script_risk",
      version: 1,
      status: "needs_review",
      requiresApproval: true,
      summary: {
        sensitiveWordCount: 2,
        copyrightRisk: "review_required",
        factualRisk: "review_required",
      },
      copyright: {
        status: "review_required",
      },
      factual: {
        status: "review_required",
      },
    });
    expect(report.hits).toEqual([
      expect.objectContaining({
        category: "sensitive_word",
        term: "绝对",
        severity: "high",
      }),
      expect.objectContaining({
        category: "sensitive_word",
        term: "第一",
        severity: "high",
      }),
    ]);
  });

  it("marks clean content as clear while still returning copyright and factual prompts", () => {
    const report = buildScriptRiskReport("这是一段自然的口播文案。");

    expect(report).toMatchObject({
      status: "clear",
      requiresApproval: false,
      summary: {
        sensitiveWordCount: 0,
        copyrightRisk: "review_required",
        factualRisk: "review_required",
      },
      hits: [],
    });
  });
});
