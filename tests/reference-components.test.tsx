import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HotContentPage from "@/app/dashboard/hot-content/page";
import { ReferenceSourceRow } from "@/components/references/ReferenceSourceRow";
import type { ReferenceSourceViewModel } from "@/components/references/types";

const baseReferenceSource: ReferenceSourceViewModel = {
  id: "reference_1",
  projectId: "project_1",
  teamId: "team_1",
  sourceType: "asset",
  platform: null,
  sourceUrl: null,
  assetId: "asset_1",
  status: "succeeded",
  durationMs: 92_000,
  transcript: "前三秒提出痛点，中段展示解决方案，结尾给出行动指令。",
  structureJson: {
    hook: "先抛出强痛点",
    rhythm: ["痛点", "方案", "行动"],
    sellingPoints: ["省时", "稳定"],
  },
  errorJson: null,
  asset: {
    id: "asset_1",
    name: "参考视频.mp4",
    type: "video",
  },
  createdAt: "2026-06-21T08:00:00.000Z",
  updatedAt: "2026-06-21T08:00:00.000Z",
};

describe("Reference extraction UI components", () => {
  it("renders the hot content page as the dedicated reference extraction workspace", () => {
    const html = renderToStaticMarkup(<HotContentPage />);

    expect(html).toContain("爆款提取");
    expect(html).toContain("从链接解析");
    expect(html).toContain("从素材提取");
    expect(html).toContain("参考来源");
    expect(html).not.toContain("该功能正在开发中");
  });

  it("renders reference extraction results with transcript and structure details", () => {
    const html = renderToStaticMarkup(
      <ReferenceSourceRow source={baseReferenceSource} retrying={false} onRetry={vi.fn()} />
    );

    expect(html).toContain("参考视频.mp4");
    expect(html).toContain("1 分 32 秒");
    expect(html).toContain("前三秒提出痛点");
    expect(html).toContain("先抛出强痛点");
    expect(html).toContain("省时");
  });

  it("renders failed reference extraction with upload fallback and retry action", () => {
    const html = renderToStaticMarkup(
      <ReferenceSourceRow
        source={{
          ...baseReferenceSource,
          status: "failed",
          transcript: null,
          structureJson: null,
          errorJson: { code: "REFERENCE_PARSE_FAILED" },
        }}
        retrying={false}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("失败");
    expect(html).toContain("链接解析失败，建议上传视频/音频继续提取。");
    expect(html).toContain("重试提取");
  });
});
