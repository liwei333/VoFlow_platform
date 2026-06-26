import { describe, expect, it } from "vitest";
import {
  buildKeywordHighlightConfig,
  extractHighlightKeywords,
} from "@/lib/editing/keyword-highlight";

describe("editing keyword highlight helpers", () => {
  it("extracts stable keywords from confirmed script content", () => {
    expect(
      extractHighlightKeywords(
        "前3秒抓住注意力！这款智能补光镜让肤色更自然，直播画面更清晰。立即下单，今天送柔光支架。"
      )
    ).toEqual(["智能补光镜", "肤色更自然", "直播画面", "立即下单", "柔光支架"]);
  });

  it("limits keyword count and removes duplicates", () => {
    expect(
      extractHighlightKeywords(
        "智能补光镜提升直播画面，智能补光镜适合短视频直播，直播画面更清晰。",
        { maxKeywords: 3 }
      )
    ).toEqual(["智能补光镜", "直播画面", "适合短视频"]);
  });

  it("returns an ASS-ready highlight style config", () => {
    expect(
      buildKeywordHighlightConfig({
        enabled: true,
        scriptContent:
          "智能补光镜让肤色更自然，直播画面更清晰。立即下单，今天送柔光支架。",
      })
    ).toEqual({
      enabled: true,
      keywords: ["智能补光镜", "肤色更自然", "直播画面", "立即下单", "柔光支架"],
      assStyle: {
        styleName: "KeywordHighlight",
        primaryColor: "&H0000D7FF",
        outlineColor: "&H00000000",
        bold: true,
      },
    });
  });

  it("keeps keyword highlight disabled without extracting keywords", () => {
    expect(
      buildKeywordHighlightConfig({
        enabled: false,
        scriptContent: "智能补光镜让直播画面更清晰。",
      })
    ).toEqual({
      enabled: false,
      keywords: [],
      assStyle: {
        styleName: "KeywordHighlight",
        primaryColor: "&H0000D7FF",
        outlineColor: "&H00000000",
        bold: true,
      },
    });
  });
});
