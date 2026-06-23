import { describe, expect, it } from "vitest";
import {
  parseSubtitleText,
  selectPreferredSubtitleTrack,
} from "@/lib/references/url-import/subtitle";

describe("reference URL subtitle import helpers", () => {
  it("selects human Chinese subtitles before automatic captions", () => {
    const track = selectPreferredSubtitleTrack({
      subtitles: {
        en: [{ ext: "vtt", url: "https://caption.example.com/en.vtt" }],
        zh: [{ ext: "vtt", url: "https://caption.example.com/zh.vtt" }],
      },
      automaticCaptions: {
        zh: [{ ext: "vtt", url: "https://caption.example.com/zh-auto.vtt" }],
      },
    });

    expect(track).toEqual({
      kind: "subtitles",
      language: "zh",
      ext: "vtt",
      url: "https://caption.example.com/zh.vtt",
    });
  });

  it("falls back to automatic captions when no human subtitle is available", () => {
    const track = selectPreferredSubtitleTrack({
      subtitles: {},
      automaticCaptions: {
        en: [{ ext: "srt", url: "https://caption.example.com/en.srt" }],
      },
    });

    expect(track).toEqual({
      kind: "automaticCaptions",
      language: "en",
      ext: "srt",
      url: "https://caption.example.com/en.srt",
    });
  });

  it("parses VTT captions into clean transcript text and ASR segments", () => {
    const result = parseSubtitleText(
      [
        "WEBVTT",
        "",
        "00:00:01.000 --> 00:00:03.500",
        "<v Speaker>第一句参考口播</v>",
        "",
        "00:00:04.000 --> 00:00:06.000",
        "第二句成交提醒",
      ].join("\n"),
      "vtt"
    );

    expect(result).toEqual({
      text: "第一句参考口播\n第二句成交提醒",
      segments: [
        { startMs: 1_000, endMs: 3_500, text: "第一句参考口播" },
        { startMs: 4_000, endMs: 6_000, text: "第二句成交提醒" },
      ],
    });
  });

  it("parses SRT captions into clean transcript text and ASR segments", () => {
    const result = parseSubtitleText(
      [
        "1",
        "00:00:01,000 --> 00:00:02,000",
        "先抛痛点",
        "",
        "2",
        "00:00:02,500 --> 00:00:04,000",
        "再给方案",
      ].join("\n"),
      "srt"
    );

    expect(result).toEqual({
      text: "先抛痛点\n再给方案",
      segments: [
        { startMs: 1_000, endMs: 2_000, text: "先抛痛点" },
        { startMs: 2_500, endMs: 4_000, text: "再给方案" },
      ],
    });
  });
});
