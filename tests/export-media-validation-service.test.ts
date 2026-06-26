import { describe, expect, it, vi } from "vitest";
import {
  buildFfprobeArgs,
  validateFinalVideoProbe,
} from "@/lib/export/media-validation";
import { validateFinalVideoFile } from "@/services/exportMediaValidationService";

describe("export media validation", () => {
  it("builds ffprobe JSON inspection args", () => {
    expect(buildFfprobeArgs("/tmp/final.mp4")).toEqual([
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "/tmp/final.mp4",
    ]);
  });

  it("accepts a non-empty final video with video/audio streams and reasonable duration", () => {
    expect(
      validateFinalVideoProbe({
        sizeBytes: 1024,
        expectedDurationSeconds: 10,
        probe: {
          format: {
            duration: "10.8",
          },
          streams: [
            { codec_type: "video" },
            { codec_type: "audio" },
          ],
        },
      })
    ).toEqual({ valid: true });
  });

  it("rejects empty files, missing streams, and excessive duration drift", () => {
    expect(
      validateFinalVideoProbe({
        sizeBytes: 0,
        probe: {
          format: { duration: "10" },
          streams: [{ codec_type: "video" }, { codec_type: "audio" }],
        },
      })
    ).toEqual({
      valid: false,
      error: {
        code: "EXPORT_MEDIA_VALIDATION_FAILED",
        message: "最终 MP4 文件为空",
      },
    });

    expect(
      validateFinalVideoProbe({
        sizeBytes: 1024,
        probe: {
          format: { duration: "10" },
          streams: [{ codec_type: "video" }],
        },
      })
    ).toEqual({
      valid: false,
      error: {
        code: "EXPORT_MEDIA_VALIDATION_FAILED",
        message: "最终 MP4 缺少音频流",
      },
    });

    expect(
      validateFinalVideoProbe({
        sizeBytes: 1024,
        expectedDurationSeconds: 10,
        probe: {
          format: { duration: "12" },
          streams: [{ codec_type: "video" }, { codec_type: "audio" }],
        },
      })
    ).toEqual({
      valid: false,
      error: {
        code: "EXPORT_MEDIA_VALIDATION_FAILED",
        message: "最终 MP4 时长偏差超过 1000ms",
      },
    });
  });

  it("runs ffprobe and returns a stable validation result", async () => {
    const inspectMedia = vi.fn().mockResolvedValue({
      format: { duration: "10" },
      streams: [{ codec_type: "video" }, { codec_type: "audio" }],
    });

    await expect(
      validateFinalVideoFile(
        {
          filePath: "/tmp/final.mp4",
          sizeBytes: 1024,
          expectedDurationSeconds: 10,
        },
        {
          inspectMedia,
        }
      )
    ).resolves.toEqual({
      valid: true,
    });

    expect(inspectMedia).toHaveBeenCalledWith("/tmp/final.mp4");
  });
});
