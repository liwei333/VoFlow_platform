import { describe, expect, it } from "vitest";
import {
  formatCheckedAt,
  formatLatency,
  getLocalModelStatusView,
  getLocalModelTypeLabel,
} from "@/lib/local-model/ui";

describe("Local model UI helpers", () => {
  it("maps local model service types to concise labels", () => {
    expect(getLocalModelTypeLabel("llm")).toBe("本地 LLM");
    expect(getLocalModelTypeLabel("asr")).toBe("ASR 转写");
    expect(getLocalModelTypeLabel("tts")).toBe("TTS 语音");
    expect(getLocalModelTypeLabel("avatar")).toBe("数字人渲染");
    expect(getLocalModelTypeLabel("ffmpeg")).toBe("FFmpeg");
  });

  it("maps local model status to labels and visual tones", () => {
    expect(getLocalModelStatusView("online")).toEqual({
      label: "在线",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      dotClassName: "bg-emerald-500",
    });
    expect(getLocalModelStatusView("offline")).toEqual({
      label: "离线",
      className: "bg-rose-50 text-rose-700 ring-rose-200",
      dotClassName: "bg-rose-500",
    });
    expect(getLocalModelStatusView("busy")).toEqual({
      label: "繁忙",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
      dotClassName: "bg-amber-500",
    });
    expect(getLocalModelStatusView("misconfigured")).toEqual({
      label: "未配置",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
      dotClassName: "bg-slate-400",
    });
  });

  it("formats latency and checked time for dense cards", () => {
    expect(formatLatency(null)).toBe("-");
    expect(formatLatency(0)).toBe("0 ms");
    expect(formatLatency(128)).toBe("128 ms");
    expect(formatCheckedAt(null)).toBe("-");
    expect(formatCheckedAt("2026-06-20T01:02:03.000Z")).toMatch(/\d{2}\/\d{2}/);
  });
});
