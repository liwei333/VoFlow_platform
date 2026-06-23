import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoicesPage from "@/app/dashboard/voices/page";
import {
  DEFAULT_VOICE_CONSENT_TEXT,
  VOICE_CONSENT_USAGE_SCOPE_OPTIONS,
} from "@/lib/voice-clone/ui";

describe("Voice UI", () => {
  it("renders voice sample upload and authorization controls", () => {
    const html = renderToStaticMarkup(<VoicesPage />);

    expect(html).toContain("我的声音");
    expect(html).toContain("上传声音样本");
    expect(html).toContain("声音授权");
    expect(html).toContain("确认声音授权");
    expect(html).toContain("开始声音训练");
    expect(html).not.toContain("该功能正在开发中");
  });

  it("provides stable voice consent copy and required usage scopes", () => {
    expect(DEFAULT_VOICE_CONSENT_TEXT).toContain("声音");
    expect(DEFAULT_VOICE_CONSENT_TEXT).toContain("授权");
    expect(VOICE_CONSENT_USAGE_SCOPE_OPTIONS).toEqual([
      { value: "voice_clone", label: "声音克隆训练" },
      { value: "tts_generation", label: "TTS 语音生成" },
    ]);
  });
});
