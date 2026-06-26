import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditingConfigPanel } from "@/components/editing/EditingConfigPanel";
import {
  EDITING_PIP_POSITION_OPTIONS,
  getEditingPipPositionLabel,
} from "@/lib/editing/ui";
import type { SerializedEditingConfig } from "@/lib/editing/serializer";

const savedConfig: SerializedEditingConfig = {
  id: "editing-config-1",
  jobId: "job-1",
  isDefault: false,
  subtitleEnabled: true,
  keywordHighlightEnabled: true,
  bgmDuckingEnabled: true,
  pipEnabled: true,
  pipAssetId: "asset-pip-1",
  pipPosition: "top_right",
  pipSize: 36,
  backgroundAssetId: "asset-bg-1",
  voiceVolume: 92,
  bgmVolume: 24,
  transitionStrength: 48,
  configJson: {
    keywordHighlight: {
      enabled: true,
      keywords: ["智能补光镜", "直播画面"],
    },
  },
  previewArtifactId: "preview-artifact-1",
  previewArtifact: {
    id: "preview-artifact-1",
    type: "editing_preview",
    storageUrl: "voflow/team/jobs/job-1/editing_preview/config.json",
    metadata: {
      previewType: "lightweight_config",
    },
    createdAt: "2026-06-24T00:00:00.000Z",
  },
  createdAt: "2026-06-24T00:00:00.000Z",
  updatedAt: "2026-06-24T00:00:00.000Z",
};

describe("editing UI", () => {
  it("renders editing controls for subtitles, pip, background, volumes, and preview", () => {
    const html = renderToStaticMarkup(
      <EditingConfigPanel
        config={savedConfig}
        mediaAssets={[
          {
            id: "asset-pip-1",
            name: "产品画中画视频",
            type: "video",
            licenseStatus: "approved",
          },
          {
            id: "asset-bg-1",
            name: "品牌背景图",
            type: "image",
            licenseStatus: "approved",
          },
          {
            id: "asset-audio-1",
            name: "背景音乐",
            type: "audio",
            licenseStatus: "approved",
          },
        ]}
        onSave={() => undefined}
        onPreview={() => undefined}
      />
    );

    expect(html).toContain("视频剪辑");
    expect(html).toContain("字幕");
    expect(html).toContain("关键词高亮");
    expect(html).toContain("BGM 自动闪避");
    expect(html).toContain("画中画");
    expect(html).toContain("产品画中画视频");
    expect(html).toContain("右上");
    expect(html).toContain("画中画大小");
    expect(html).toContain("背景素材");
    expect(html).toContain("品牌背景图");
    expect(html).not.toContain("背景音乐");
    expect(html).toContain("人声音量");
    expect(html).toContain("BGM 音量");
    expect(html).toContain("转场强度");
    expect(html).toContain("智能补光镜");
    expect(html).toContain("直播画面");
    expect(html).toContain("生成剪辑预览");
    expect(html).toContain("保存剪辑配置");
  });

  it("keeps editing UI labels and pip options in the shared UI module", () => {
    expect(EDITING_PIP_POSITION_OPTIONS).toEqual([
      { value: "top_left", label: "左上" },
      { value: "top_right", label: "右上" },
      { value: "bottom_left", label: "左下" },
      { value: "bottom_right", label: "右下" },
    ]);
    expect(getEditingPipPositionLabel("bottom_right")).toBe("右下");
  });
});
