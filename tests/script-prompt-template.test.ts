import { describe, expect, it } from "vitest";
import { buildRewriteScriptPrompt } from "@/lib/scripts/promptTemplates";

describe("rewrite script prompt template", () => {
  it("builds a reusable prompt with source script, platform, duration, tone, and forbidden words", () => {
    const prompt = buildRewriteScriptPrompt({
      script: "这是一段偏书面的产品介绍",
      platform: "douyin",
      durationSeconds: 45,
      tone: "friendly",
      forbiddenWords: ["绝对", "第一"],
      candidateCount: 4,
    });

    expect(prompt).toMatchObject({
      promptType: "script_rewrite",
      version: 1,
      params: {
        platform: "douyin",
        durationSeconds: 45,
        tone: "friendly",
        forbiddenWords: ["绝对", "第一"],
        candidateCount: 4,
      },
    });
    expect(prompt.messages).toHaveLength(2);
    expect(prompt.messages[0]).toMatchObject({
      role: "system",
    });
    expect(prompt.messages[1].content).toContain("这是一段偏书面的产品介绍");
    expect(prompt.messages[1].content).toContain("douyin");
    expect(prompt.messages[1].content).toContain("45 秒");
    expect(prompt.messages[1].content).toContain("friendly");
    expect(prompt.messages[1].content).toContain("绝对,第一");
    expect(prompt.messages[1].content).toContain("4 个");
    expect(prompt.messages[1].content).toContain("口播自然");
    expect(prompt.messages[1].content).toContain("结构清晰");
    expect(prompt.messages[1].content).toContain("避免照搬");
    expect(prompt.messages[1].content).toContain("\"candidates\"");
  });

  it("keeps rewrite candidates within the 3 to 5 range", () => {
    expect(buildRewriteScriptPrompt({ script: "短文案", candidateCount: 1 }).params.candidateCount).toBe(3);
    expect(buildRewriteScriptPrompt({ script: "短文案", candidateCount: 7 }).params.candidateCount).toBe(5);
  });
});
