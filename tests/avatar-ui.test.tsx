import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AvatarsPage, { getAvatarPreviewDisplay } from "@/app/dashboard/avatars/page";
import {
  AVATAR_CONSENT_USAGE_SCOPE_OPTIONS,
  DEFAULT_AVATAR_CONSENT_TEXT,
  getAvatarLicenseStatusView,
  getAvatarStatusView,
} from "@/lib/avatar/ui";

describe("Avatar UI", () => {
  it("renders the avatar creation workspace instead of a placeholder", () => {
    const html = renderToStaticMarkup(<AvatarsPage />);

    expect(html).toContain("我的数字人");
    expect(html).toContain("上传本人照片");
    expect(html).toContain("照片质检");
    expect(html).toContain("肖像授权");
    expect(html).toContain("数字人列表");
    expect(html).toContain("创建数字人");
    expect(html).toContain("设为默认");
    expect(html).toContain("删除");
    expect(html).not.toContain("该功能正在开发中");
  });

  it("provides stable status labels and required portrait consent copy", () => {
    expect(DEFAULT_AVATAR_CONSENT_TEXT).toContain("肖像");
    expect(DEFAULT_AVATAR_CONSENT_TEXT).toContain("授权");
    expect(AVATAR_CONSENT_USAGE_SCOPE_OPTIONS).toEqual([
      { value: "avatar_generation", label: "数字人生成" },
      { value: "video_generation", label: "口播视频生成" },
    ]);
    expect(getAvatarStatusView("ready").label).toBe("可用");
    expect(getAvatarStatusView("deleted").label).toBe("已删除");
    expect(getAvatarLicenseStatusView("approved").label).toBe("已授权");
  });

  it("labels source-image fallback separately from generated avatar preview", () => {
    expect(
      getAvatarPreviewDisplay({
        previewUrl: null,
        sourceAsset: {
          accessUrl: "https://cdn.example.com/source.png",
        },
      })
    ).toEqual({
      imageUrl: "https://cdn.example.com/source.png",
      label: "源照片",
    });

    expect(
      getAvatarPreviewDisplay({
        previewUrl: "https://cdn.example.com/avatar-preview.png",
        sourceAsset: {
          accessUrl: "https://cdn.example.com/source.png",
        },
      })
    ).toEqual({
      imageUrl: "https://cdn.example.com/avatar-preview.png",
      label: "数字人预览",
    });
  });
});
