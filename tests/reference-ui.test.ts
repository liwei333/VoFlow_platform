import { describe, expect, it } from "vitest";
import {
  getReferenceFallbackMessage,
  getReferenceLinkPlatformPreview,
  getReferenceUrlImportUiState,
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

  it("recommends subtitle import when parsed metadata exposes subtitle tracks", () => {
    const state = getReferenceUrlImportUiState({
      status: "metadata_ready",
      title: "参考视频标题",
      platform: "youtube",
      durationMs: 92_000,
      thumbnailUrl: "https://example.com/thumb.jpg",
      subtitleJson: {
        subtitles: {
          zh: [{ ext: "vtt", url: "https://example.com/zh.vtt" }],
        },
        automaticCaptions: {},
      },
      errorJson: null,
    });

    expect(state).toMatchObject({
      title: "参考视频标题",
      subtitleAvailabilityLabel: "有可用字幕",
      recommendedImportMode: "subtitle_only",
      recommendedImportModeLabel: "优先导入字幕",
      requiresConsent: true,
      canImport: true,
    });
    expect(state.consentText).toContain("reference-analysis-only");
    expect(state.boundaryText).toContain("不提供完整视频下载");
  });

  it("recommends audio extraction fallback when metadata has no subtitles", () => {
    const state = getReferenceUrlImportUiState({
      status: "metadata_ready",
      title: null,
      platform: "bilibili",
      durationMs: 45_000,
      thumbnailUrl: null,
      subtitleJson: { subtitles: {}, automaticCaptions: {} },
      errorJson: null,
    });

    expect(state).toMatchObject({
      title: "未命名参考链接",
      subtitleAvailabilityLabel: "未发现字幕",
      recommendedImportMode: "audio_extract",
      recommendedImportModeLabel: "授权后提取音频",
      fallbackText: "未发现可用字幕，可授权仅提取音频用于参考分析，或改用上传素材。",
      requiresConsent: true,
      canImport: true,
    });
  });

  it("surfaces import fallback copy when metadata parsing fails", () => {
    const state = getReferenceUrlImportUiState({
      status: "failed",
      title: null,
      platform: null,
      durationMs: null,
      thumbnailUrl: null,
      subtitleJson: null,
      errorJson: { code: "REFERENCE_SUBTITLE_UNAVAILABLE" },
    });

    expect(state).toMatchObject({
      subtitleAvailabilityLabel: "未发现字幕",
      recommendedImportMode: "metadata_only",
      recommendedImportModeLabel: "仅保存 metadata",
      fallbackText: "参考链接没有可用字幕，请改用上传素材或音频提取路径。",
      canImport: false,
    });
  });
});
