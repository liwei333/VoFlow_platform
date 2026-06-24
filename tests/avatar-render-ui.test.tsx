import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VoicesPage from "@/app/dashboard/voices/page";
import { AvatarRenderPanel } from "@/components/avatar-render/AvatarRenderPanel";
import {
  AVATAR_RENDER_CROP_OPTIONS,
  getAvatarRenderNodeStatusLabel,
} from "@/lib/avatar-render/ui";
import type { TtsResultViewModel } from "@/components/tts/TtsResultPanel";

const approvedTtsResult: TtsResultViewModel = {
  id: "tts-request-1",
  jobId: "job-1",
  status: "approved",
  speed: 1,
  pitch: 1,
  pauseJson: null,
  provider: "mock",
  providerRequestId: "mock-tts-1",
  createdAt: "2026-06-24T00:00:00.000Z",
  updatedAt: "2026-06-24T00:00:00.000Z",
  node: {
    id: "tts-node-1",
    status: "approved",
    version: 1,
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
    id: "audio-artifact-1",
    type: "audio",
    storageUrl: "voflow/team/jobs/job-1/tts/voice.wav",
    accessUrl: "https://cdn.example.com/voice.wav",
    metadata: {
      durationMs: 2400,
      format: "wav",
    },
    createdAt: "2026-06-24T00:00:00.000Z",
  },
};

describe("Avatar render UI", () => {
  it("renders the avatar render workspace on the voices page", () => {
    const html = renderToStaticMarkup(<VoicesPage />);

    expect(html).toContain("数字人渲染");
    expect(html).toContain("选择数字人和已确认语音，先生成低清预览再确认高清渲染");
    expect(html).not.toContain("该功能正在开发中");
  });

  it("renders avatar selection, crop options, preview video, and confirm actions", () => {
    const html = renderToStaticMarkup(
      <AvatarRenderPanel
        jobId="job-1"
        projectAspectRatio="9:16"
        ttsResults={[approvedTtsResult]}
        initialAvatars={[
          {
            id: "avatar-1",
            name: "本人数字人",
            status: "ready",
            licenseStatus: "approved",
            previewUrl: "https://cdn.example.com/avatar.png",
            isDefault: true,
          },
        ]}
        initialResults={[
          {
            id: "render-preview-1",
            jobId: "job-1",
            nodeId: "avatar-node-1",
            avatarId: "avatar-1",
            audioArtifactId: "audio-artifact-1",
            mode: "preview",
            aspectRatio: "9:16",
            crop: "half_body",
            provider: "mock",
            providerRequestId: "mock-render-1",
            createdAt: "2026-06-24T00:00:00.000Z",
            updatedAt: "2026-06-24T00:00:00.000Z",
            node: {
              id: "avatar-node-1",
              status: "waiting_approval",
              version: 1,
              requiresApproval: true,
              output: null,
              error: null,
            },
            avatar: {
              id: "avatar-1",
              name: "本人数字人",
              previewUrl: "https://cdn.example.com/avatar.png",
            },
            videoArtifact: {
              id: "video-artifact-1",
              type: "avatar_video",
              storageUrl: "voflow/team/jobs/job-1/avatar_render/preview.mp4",
              accessUrl: "https://cdn.example.com/preview.mp4",
              metadata: {
                durationMs: 2400,
              },
              createdAt: "2026-06-24T00:00:00.000Z",
            },
          },
        ]}
        onError={() => undefined}
        onNotice={() => undefined}
      />
    );

    expect(html).toContain("数字人渲染");
    expect(html).toContain("本人数字人");
    expect(html).toContain("竖版 9:16");
    expect(html).toContain("半身");
    expect(html).toContain("头像");
    expect(html).toContain("清亮女声");
    expect(html).toContain("生成低清预览");
    expect(html).toContain("确认预览");
    expect(html).toContain("重新预览");
    expect(html).toContain("https://cdn.example.com/preview.mp4");
  });

  it("keeps render labels in the shared UI module", () => {
    expect(AVATAR_RENDER_CROP_OPTIONS).toEqual([
      { value: "half_body", label: "半身" },
      { value: "head", label: "头像" },
    ]);
    expect(getAvatarRenderNodeStatusLabel("waiting_approval")).toBe("待确认预览");
    expect(getAvatarRenderNodeStatusLabel("approved")).toBe("已确认");
  });
});
