import { describe, expect, it } from "vitest";
import {
  getReferenceFallbackMessage,
  getReferenceLinkPlatformPreview,
  getReferenceSourceStatusView,
  isReferenceSelectableMediaAsset,
} from "@/lib/references/ui";

describe("Reference UI helpers", () => {
  it("maps reference source statuses to visible labels and polling state", () => {
    expect(getReferenceSourceStatusView("pending")).toMatchObject({
      label: "待处理",
      isActive: true,
    });
    expect(getReferenceSourceStatusView("transcribing")).toMatchObject({
      label: "转写中",
      isActive: true,
    });
    expect(getReferenceSourceStatusView("analyzing")).toMatchObject({
      label: "分析中",
      isActive: true,
    });
    expect(getReferenceSourceStatusView("succeeded")).toMatchObject({
      label: "已完成",
      isActive: false,
    });
    expect(getReferenceSourceStatusView("failed")).toMatchObject({
      label: "失败",
      isActive: false,
    });
  });

  it("recognizes supported reference link platforms before submit", () => {
    expect(getReferenceLinkPlatformPreview("https://v.douyin.com/iABC12/")).toEqual({
      supported: true,
      label: "抖音",
      platform: "douyin",
      message: "已识别为抖音链接",
    });

    expect(getReferenceLinkPlatformPreview("https://example.com/watch/1")).toMatchObject({
      supported: false,
      message: "不支持该参考链接平台，请改用上传视频/音频或粘贴文案。",
    });
  });

  it("keeps the reference asset picker limited to approved audio and video", () => {
    expect(isReferenceSelectableMediaAsset({ type: "audio", licenseStatus: "approved" })).toBe(true);
    expect(isReferenceSelectableMediaAsset({ type: "video", licenseStatus: "approved" })).toBe(true);
    expect(isReferenceSelectableMediaAsset({ type: "image", licenseStatus: "approved" })).toBe(false);
    expect(isReferenceSelectableMediaAsset({ type: "audio", licenseStatus: "pending" })).toBe(false);
  });

  it("provides explicit fallback copy for parse and analysis failures", () => {
    expect(getReferenceFallbackMessage({ code: "REFERENCE_PARSE_FAILED" })).toBe(
      "链接解析失败，建议上传视频/音频继续提取。"
    );
    expect(getReferenceFallbackMessage({ code: "REFERENCE_ASR_FAILED" })).toBe(
      "音视频转写失败，请检查素材后重试。"
    );
    expect(getReferenceFallbackMessage({ code: "REFERENCE_STRUCTURE_FAILED" })).toBe(
      "结构分析失败，请重试参考提取。"
    );
  });
});
