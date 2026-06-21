import { describe, expect, it } from "vitest";
import {
  REFERENCE_PLATFORM_ERROR_CODES,
  REFERENCE_PLATFORMS,
  ReferencePlatformError,
  detectReferencePlatform,
  getReferencePlatformDefinition,
  isReferencePlatform,
} from "@/lib/references/platforms";

describe("reference platform detection", () => {
  it("defines the supported platform list in one ordered registry", () => {
    expect(REFERENCE_PLATFORMS).toEqual([
      "douyin",
      "kuaishou",
      "xiaohongshu",
      "wechat_channels",
      "bilibili",
      "youtube",
      "tiktok",
    ]);

    for (const platform of REFERENCE_PLATFORMS) {
      const definition = getReferencePlatformDefinition(platform);
      expect(definition).toMatchObject({
        platform,
        label: expect.any(String),
        hosts: expect.any(Array),
      });
      expect(definition.hosts.length).toBeGreaterThan(0);
    }
  });

  it.each([
    ["douyin", "https://www.douyin.com/video/123", "https://v.douyin.com/iABC12/"],
    ["kuaishou", "https://www.kuaishou.com/short-video/abc", "https://v.kuaishou.com/AbCdEf"],
    ["xiaohongshu", "https://www.xiaohongshu.com/explore/123", "https://xhslink.com/a/AbCd"],
    ["wechat_channels", "https://channels.weixin.qq.com/mobile/video/123", "https://weixin.qq.com/sph/AbCd"],
    ["bilibili", "https://www.bilibili.com/video/BV123", "https://b23.tv/BV123"],
    ["youtube", "https://www.youtube.com/watch?v=abc", "https://youtu.be/abc"],
    ["tiktok", "https://www.tiktok.com/@user/video/123", "https://vm.tiktok.com/ZMabc/"],
  ] as const)("detects %s from long and short hosts", (platform, longUrl, shortUrl) => {
    expect(detectReferencePlatform(longUrl).platform).toBe(platform);
    expect(detectReferencePlatform(shortUrl).platform).toBe(platform);
  });

  it("normalizes protocol-less input and nested subdomains", () => {
    expect(detectReferencePlatform("m.douyin.com/share/video/123")).toMatchObject({
      platform: "douyin",
      normalizedHost: "m.douyin.com",
    });
    expect(detectReferencePlatform("https://creator.www.youtube.com/watch?v=abc")).toMatchObject({
      platform: "youtube",
      normalizedHost: "creator.www.youtube.com",
    });
  });

  it("rejects unsupported platforms with an explicit error code", () => {
    expect(() => detectReferencePlatform("https://example.com/video/123")).toThrow(
      ReferencePlatformError
    );

    try {
      detectReferencePlatform("https://example.com/video/123");
      throw new Error("Expected unsupported platform to throw");
    } catch (error) {
      expect(error).toMatchObject({
        code: REFERENCE_PLATFORM_ERROR_CODES.UNSUPPORTED,
        message: "不支持该参考链接平台，请改用上传视频/音频或粘贴文案。",
      });
    }
  });

  it("rejects invalid URLs before platform matching", () => {
    expect(() => detectReferencePlatform("not a url")).toThrow(
      expect.objectContaining({
        code: REFERENCE_PLATFORM_ERROR_CODES.INVALID_URL,
      })
    );
  });

  it("exposes a type guard for persisted reference platform values", () => {
    expect(isReferencePlatform("douyin")).toBe(true);
    expect(isReferencePlatform("unknown")).toBe(false);
    expect(isReferencePlatform(null)).toBe(false);
  });
});
