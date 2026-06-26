import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExportPanel } from "@/components/export/ExportPanel";

describe("ExportPanel", () => {
  it("renders export summary, profile actions, and download action", () => {
    const html = renderToStaticMarkup(
      <ExportPanel
        selectedJobId="job-1"
        subtitleSummary="2 条字幕 / ASS"
        latestExport={{
          id: "export-1",
          outputProfile: "mp4_1080p",
          status: "succeeded",
          subtitleArtifactId: "subtitle-1",
          bgmAssetId: null,
          coverArtifactId: "cover-1",
          finalVideoArtifact: {
            id: "final-video-1",
            storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
          },
        }}
        creating={false}
        downloadingArtifactId={null}
        onCreateExport={vi.fn()}
        onDownload={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain("最终导出");
    expect(html).toContain("MP4 1080p / 已完成");
    expect(html).toContain("2 条字幕 / ASS");
    expect(html).toContain("无 BGM");
    expect(html).toContain("已生成封面");
    expect(html).toContain("导出 1080p");
    expect(html).toContain("导出 720p");
    expect(html).toContain("下载 MP4");
  });
});
