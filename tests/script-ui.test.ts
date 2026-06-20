import { describe, expect, it } from "vitest";
import {
  extractRiskSummary,
  formatAsrSegmentsSummary,
  formatEstimatedSpeechDuration,
  formatMediaDuration,
  getCandidateStatusView,
  isTranscribableMediaAsset,
  normalizeTitleCandidates,
} from "@/lib/scripts/ui";

describe("Script UI helpers", () => {
  it("formats estimated speech duration from pasted script length", () => {
    expect(formatEstimatedSpeechDuration("")).toBe("约 0 秒");
    expect(formatEstimatedSpeechDuration("这是一段口播文案")).toBe("约 3 秒");
    expect(formatEstimatedSpeechDuration("字".repeat(260))).toBe("约 1 分 5 秒");
  });

  it("normalizes title candidates from JSON values", () => {
    expect(normalizeTitleCandidates(["标题1", "标题2", 3, ""])).toEqual(["标题1", "标题2"]);
    expect(normalizeTitleCandidates(null)).toEqual([]);
    expect(normalizeTitleCandidates({ titles: ["标题A", "标题B"] })).toEqual([]);
  });

  it("extracts a compact risk summary for explicit confirmation", () => {
    expect(
      extractRiskSummary({
        status: "needs_review",
        requiresApproval: true,
        findings: [
          { keyword: "绝对", message: "命中敏感词" },
          { message: "需确认版权来源" },
        ],
      })
    ).toEqual({
      requiresApproval: true,
      label: "需人工确认",
      messages: ["命中敏感词", "需确认版权来源"],
    });

    expect(extractRiskSummary(null)).toEqual({
      requiresApproval: false,
      label: "未检查",
      messages: [],
    });
  });

  it("maps candidate statuses to labels and button availability", () => {
    expect(getCandidateStatusView("draft")).toMatchObject({
      label: "待确认",
      canApprove: true,
    });
    expect(getCandidateStatusView("approved")).toMatchObject({
      label: "已确认",
      canApprove: false,
    });
    expect(getCandidateStatusView("rejected")).toMatchObject({
      label: "已排除",
      canApprove: false,
    });
  });

  it("formats media duration from asset metadata", () => {
    expect(formatMediaDuration({ durationMs: 125_000 })).toBe("2 分 5 秒");
    expect(formatMediaDuration({ durationSeconds: 91 })).toBe("1 分 31 秒");
    expect(formatMediaDuration({ width: 1080 })).toBe("未知时长");
  });

  it("filters transcribable approved audio and video assets", () => {
    expect(isTranscribableMediaAsset({ type: "audio", licenseStatus: "approved" })).toBe(true);
    expect(isTranscribableMediaAsset({ type: "video", licenseStatus: "approved" })).toBe(true);
    expect(isTranscribableMediaAsset({ type: "image", licenseStatus: "approved" })).toBe(false);
    expect(isTranscribableMediaAsset({ type: "audio", licenseStatus: "pending" })).toBe(false);
  });

  it("summarizes ASR segments for the transcription list", () => {
    expect(formatAsrSegmentsSummary([])).toBe("0 段");
    expect(
      formatAsrSegmentsSummary([
        { startMs: 0, endMs: 10_000, text: "第一段" },
        { startMs: 10_000, endMs: 25_000, text: "第二段" },
      ])
    ).toBe("2 段 / 25 秒");
  });
});
