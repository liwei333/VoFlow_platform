import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoicesPage from "@/app/dashboard/voices/page";
import { TtsResultPanel } from "@/components/tts/TtsResultPanel";

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

  it("renders generated audio with confirm and regenerate actions", () => {
    const html = renderToStaticMarkup(
      <TtsResultPanel
        selectedVoiceLabel="清亮女声 / preset-clear-female"
        results={[
          {
            id: "tts-request-1",
            jobId: "job-1",
            status: "waiting_approval",
            speed: 1.05,
            pitch: 1,
            pauseJson: null,
            provider: "mock",
            providerRequestId: "mock-request-1",
            createdAt: "2026-06-21T00:00:00.000Z",
            updatedAt: "2026-06-21T00:00:00.000Z",
            node: {
              id: "node-tts-1",
              status: "waiting_approval",
              version: 2,
              requiresApproval: true,
            },
            voice: {
              id: "voice-1",
              name: "清亮女声",
              provider: "mock",
              modelId: "preset-clear-female",
            },
            scriptCandidate: {
              id: "candidate-1",
              contentPreview: "确认后的口播文案",
            },
            audioArtifact: {
              id: "artifact-1",
              type: "audio",
              storageUrl: "voflow/team/jobs/job/tts/request.wav",
              accessUrl: "https://example.com/request.wav",
              metadata: {
                durationMs: 2400,
                sampleRate: 16000,
                format: "wav",
              },
              createdAt: "2026-06-21T00:00:00.000Z",
            },
          },
        ]}
        approvingNodeId={null}
        regenerating={false}
        onRefresh={() => undefined}
        onConfirm={() => undefined}
        onRegenerate={() => undefined}
      />
    );

    expect(html).toContain("语音结果");
    expect(html).toContain("清亮女声");
    expect(html).toContain("确认后的口播文案");
    expect(html).toContain("2 秒");
    expect(html).toContain("确认语音");
    expect(html).toContain("重新生成");
    expect(html).toContain("https://example.com/request.wav");
  });
});
