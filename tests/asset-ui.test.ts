import { describe, expect, it } from "vitest";
import {
  ASSET_TYPE_OPTIONS,
  ASSET_USAGE_SCOPE_OPTIONS,
  DEFAULT_ASSET_CONSENT_TEXT,
  formatAssetSize,
  getAssetTypeLabel,
  getLicenseStatusView,
} from "@/lib/assets/ui";

describe("Asset UI helpers", () => {
  it("provides stable asset type labels for the upload form and list filters", () => {
    expect(ASSET_TYPE_OPTIONS).toEqual([
      { value: "image", label: "图片" },
      { value: "audio", label: "音频" },
      { value: "video", label: "视频" },
      { value: "subtitle", label: "字幕" },
      { value: "bgm", label: "背景音乐" },
      { value: "cover", label: "封面" },
      { value: "avatar_source", label: "数字人源素材" },
      { value: "artifact", label: "产物" },
    ]);

    expect(getAssetTypeLabel("avatar_source")).toBe("数字人源素材");
  });

  it("maps license status to concise labels and visual tones", () => {
    expect(getLicenseStatusView("pending")).toEqual({
      label: "待授权",
      className: "bg-amber-50 text-amber-700 ring-amber-200",
    });
    expect(getLicenseStatusView("approved")).toEqual({
      label: "已授权",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    });
    expect(getLicenseStatusView("rejected")).toEqual({
      label: "已拒绝",
      className: "bg-rose-50 text-rose-700 ring-rose-200",
    });
    expect(getLicenseStatusView("expired")).toEqual({
      label: "已过期",
      className: "bg-slate-100 text-slate-700 ring-slate-200",
    });
  });

  it("formats byte counts for dense table display", () => {
    expect(formatAssetSize("0")).toBe("0 B");
    expect(formatAssetSize("512")).toBe("512 B");
    expect(formatAssetSize("1536")).toBe("1.5 KB");
    expect(formatAssetSize("1048576")).toBe("1 MB");
    expect(formatAssetSize("3145728")).toBe("3 MB");
  });

  it("provides consent text and usage scope options for the confirmation modal", () => {
    expect(DEFAULT_ASSET_CONSENT_TEXT).toContain("确认");
    expect(DEFAULT_ASSET_CONSENT_TEXT).toContain("授权");
    expect(ASSET_USAGE_SCOPE_OPTIONS).toEqual([
      { value: "video_generation", label: "视频生成" },
      { value: "avatar_generation", label: "数字人生成" },
      { value: "publishing", label: "内容发布" },
    ]);
  });
});
