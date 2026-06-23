import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoicesPage from "@/app/dashboard/voices/page";
import {
  DEFAULT_VOICE_CONSENT_TEXT,
  VOICE_CONSENT_USAGE_SCOPE_OPTIONS,
  getVoiceLicenseLabel,
  getVoiceStatusLabel,
  groupVoicesByType,
} from "@/lib/voice-clone/ui";

describe("Voice UI", () => {
  it("renders voice sample upload and authorization controls", () => {
    const html = renderToStaticMarkup(<VoicesPage />);

    expect(html).toContain("我的声音");
    expect(html).toContain("上传声音样本");
    expect(html).toContain("声音授权");
    expect(html).toContain("确认声音授权");
    expect(html).toContain("开始声音训练");
    expect(html).toContain("预置音色");
    expect(html).toContain("克隆音色");
    expect(html).toContain("试听");
    expect(html).toContain("重训");
    expect(html).toContain("删除");
    expect(html).toContain("授权状态");
    expect(html).toContain("训练状态");
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

  it("groups preset and cloned voices and exposes stable status labels", () => {
    const baseVoice = {
      id: "voice-1",
      teamId: null,
      ownerId: null,
      name: "清亮女声",
      provider: "mock",
      modelId: "preset-clear-female",
      status: "active",
      licenseStatus: "approved",
      sampleUrl: null,
      gender: null,
      style: null,
      language: null,
      metadata: null,
      createdAt: "2026-06-23T00:00:00.000Z",
      updatedAt: "2026-06-23T00:00:00.000Z",
    };

    const grouped = groupVoicesByType([
      { ...baseVoice, id: "preset-voice", voiceType: "preset" },
      { ...baseVoice, id: "cloned-voice", voiceType: "cloned", teamId: "team-1" },
    ]);

    expect(grouped.preset.map((voice) => voice.id)).toEqual(["preset-voice"]);
    expect(grouped.cloned.map((voice) => voice.id)).toEqual(["cloned-voice"]);
    expect(getVoiceStatusLabel("active")).toBe("可用");
    expect(getVoiceStatusLabel("disabled")).toBe("已停用");
    expect(getVoiceLicenseLabel("approved")).toBe("授权通过");
    expect(getVoiceLicenseLabel("pending")).toBe("授权待确认");
  });
});
