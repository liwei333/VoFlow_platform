import { describe, expect, it } from "vitest";
import {
  PUBLISH_PLATFORMS,
  PublishPlatformRuleError,
  getPublishPlatformRule,
  isPublishPlatform,
  listPublishPlatformRules,
} from "@/lib/publish/rules";

describe("publish platform rules", () => {
  it("exposes the configured publish platforms in schema order", () => {
    expect(PUBLISH_PLATFORMS).toEqual([
      "douyin",
      "kuaishou",
      "xiaohongshu",
      "wechat_channels",
      "bilibili",
      "youtube_shorts",
      "tiktok",
    ]);
  });

  it("returns title, tag, cover, and duration rules for every publish platform", () => {
    const rules = listPublishPlatformRules();

    expect(rules).toHaveLength(PUBLISH_PLATFORMS.length);

    for (const rule of rules) {
      expect(rule.platform).toSatisfy(isPublishPlatform);
      expect(rule.label.length).toBeGreaterThan(0);
      expect(rule.title.maxChars).toBeGreaterThan(0);
      expect(rule.tags.maxCount).toBeGreaterThan(0);
      expect(rule.cover.allowedAspectRatios.length).toBeGreaterThan(0);
      expect(rule.video.minDurationSeconds).toBeGreaterThanOrEqual(0);
      expect(rule.video.maxDurationSeconds).toBeGreaterThan(rule.video.minDurationSeconds);
    }
  });

  it("configures known short-video platform limits in one shared module", () => {
    expect(getPublishPlatformRule("douyin")).toMatchObject({
      label: "抖音",
      title: { maxChars: 55 },
      tags: { maxCount: 5 },
      cover: { allowedAspectRatios: ["9:16", "16:9"] },
      video: { minDurationSeconds: 1, maxDurationSeconds: 900 },
    });

    expect(getPublishPlatformRule("youtube_shorts")).toMatchObject({
      label: "YouTube Shorts",
      title: { maxChars: 100 },
      tags: { maxCount: 15 },
      cover: { allowedAspectRatios: ["9:16", "1:1"] },
      video: { minDurationSeconds: 1, maxDurationSeconds: 180 },
    });

    expect(getPublishPlatformRule("tiktok")).toMatchObject({
      label: "TikTok",
      title: { maxChars: 2200 },
      tags: { maxCount: 20 },
      cover: { allowedAspectRatios: ["9:16"] },
      video: { minDurationSeconds: 1, maxDurationSeconds: 600 },
    });
  });

  it("rejects unknown platforms with a stable domain error", () => {
    expect(isPublishPlatform("unknown")).toBe(false);
    expect(() => getPublishPlatformRule("unknown")).toThrow(PublishPlatformRuleError);

    try {
      getPublishPlatformRule("unknown");
    } catch (error) {
      expect(error).toMatchObject({
        code: "PUBLISH_PLATFORM_UNSUPPORTED",
        message: "不支持该发布平台",
      });
    }
  });
});
