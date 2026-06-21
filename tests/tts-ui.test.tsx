import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoicesPage from "@/app/dashboard/voices/page";

describe("TTS UI", () => {
  it("renders the voice selection and TTS generation workspace", () => {
    const html = renderToStaticMarkup(<VoicesPage />);

    expect(html).toContain("我的声音");
    expect(html).toContain("音色选择");
    expect(html).toContain("语音参数");
    expect(html).toContain("生成语音");
    expect(html).toContain("语音结果");
    expect(html).not.toContain("该功能正在开发中");
  });
});
