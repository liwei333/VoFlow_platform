import { describe, expect, it, vi } from "vitest";
import {
  REFERENCE_LINK_PARSE_ERROR_CODES,
  parseReferenceLink,
  type ReferenceLinkParser,
} from "@/lib/references/parser";

describe("reference link parser", () => {
  it("detects the platform and dispatches to the matching adapter", async () => {
    const douyinParser: ReferenceLinkParser = {
      parse: vi.fn().mockResolvedValue({
        title: "爆款口播参考",
        durationMs: 45000,
        mediaUrl: "https://media.example.com/reference.mp4",
        raw: { parser: "fixture" },
      }),
    };

    const result = await parseReferenceLink("https://www.douyin.com/video/123", {
      adapters: {
        douyin: douyinParser,
      },
    });

    expect(result).toEqual({
      success: true,
      sourceUrl: "https://www.douyin.com/video/123",
      platform: "douyin",
      label: "抖音",
      normalizedUrl: "https://www.douyin.com/video/123",
      normalizedHost: "www.douyin.com",
      parsed: {
        title: "爆款口播参考",
        durationMs: 45000,
        mediaUrl: "https://media.example.com/reference.mp4",
        raw: { parser: "fixture" },
      },
    });
    expect(douyinParser.parse).toHaveBeenCalledWith({
      sourceUrl: "https://www.douyin.com/video/123",
      platform: "douyin",
      adapterKey: "douyin",
      normalizedUrl: "https://www.douyin.com/video/123",
      normalizedHost: "www.douyin.com",
    });
  });

  it("returns an explicit parse failure that preserves the source URL and platform", async () => {
    const failingParser: ReferenceLinkParser = {
      parse: vi.fn().mockRejectedValue(new Error("remote page blocked")),
    };

    const result = await parseReferenceLink("https://v.douyin.com/iABC12/", {
      adapters: {
        douyin: failingParser,
      },
    });

    expect(result).toEqual({
      success: false,
      sourceUrl: "https://v.douyin.com/iABC12/",
      platform: "douyin",
      label: "抖音",
      normalizedUrl: "https://v.douyin.com/iABC12/",
      normalizedHost: "v.douyin.com",
      error: {
        code: REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
        message: "链接解析失败，请改用上传视频/音频或粘贴文案。",
        detail: "remote page blocked",
      },
      fallback: {
        action: "upload_media_or_paste_text",
        message: "请上传视频/音频或直接粘贴文案继续提取。",
      },
    });
  });

  it("uses a default parser that keeps supported URLs for later fallback flow", async () => {
    const result = await parseReferenceLink("https://www.bilibili.com/video/BV123");

    expect(result).toMatchObject({
      success: false,
      sourceUrl: "https://www.bilibili.com/video/BV123",
      platform: "bilibili",
      error: {
        code: REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
      },
      fallback: {
        action: "upload_media_or_paste_text",
      },
    });
  });
});
