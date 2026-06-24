import { describe, expect, it, vi } from "vitest";
import {
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_MIN_OUTPUT_BYTES,
  AVATAR_RENDER_VIDEO_CONTENT_TYPE,
  AVATAR_RENDER_VIDEO_EXTENSION,
} from "@/lib/avatar-render/constants";
import {
  AvatarRenderOutputValidationError,
  createFfprobeVideoProbe,
  validateAvatarRenderOutput,
} from "@/lib/avatar-render/output-validation";

describe("avatar render output validation", () => {
  it("returns the video buffer and normalized probe metadata for valid output", async () => {
    const videoBuffer = Buffer.alloc(AVATAR_RENDER_MIN_OUTPUT_BYTES + 1, 1);
    const statFile = vi.fn(async () => ({
      size: videoBuffer.length,
      isFile: () => true,
    }));
    const readFile = vi.fn(async () => videoBuffer);
    const probeVideo = vi.fn(async () => ({
      durationMs: 1210,
      videoStreamCount: 1,
      codecName: "h264",
    }));

    const result = await validateAvatarRenderOutput(
      {
        videoPath: "/tmp/avatar-render/output.mp4",
        expectedDurationMs: 1200,
        contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
        fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
      },
      {
        statFile,
        readFile,
        probeVideo,
      }
    );

    expect(result).toEqual({
      videoBuffer,
      metadata: {
        sizeBytes: videoBuffer.length,
        durationMs: 1210,
        expectedDurationMs: 1200,
        videoStreamCount: 1,
        codecName: "h264",
        contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
        fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
      },
    });
    expect(statFile).toHaveBeenCalledWith("/tmp/avatar-render/output.mp4");
    expect(probeVideo).toHaveBeenCalledWith("/tmp/avatar-render/output.mp4");
    expect(readFile).toHaveBeenCalledWith("/tmp/avatar-render/output.mp4");
  });

  it("rejects output files below the minimum byte threshold before probing", async () => {
    const probeVideo = vi.fn();
    const readFile = vi.fn();

    await expect(
      validateAvatarRenderOutput(
        {
          videoPath: "/tmp/avatar-render/tiny.mp4",
          expectedDurationMs: 1200,
          contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
          fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
        },
        {
          statFile: async () => ({
            size: AVATAR_RENDER_MIN_OUTPUT_BYTES - 1,
            isFile: () => true,
          }),
          readFile,
          probeVideo,
        }
      )
    ).rejects.toMatchObject({
      code: AVATAR_RENDER_ERROR_CODES.invalidProviderOutput,
    } satisfies Partial<AvatarRenderOutputValidationError>);
    expect(probeVideo).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects ffprobe output without a valid video stream and duration", async () => {
    await expect(
      validateAvatarRenderOutput(
        {
          videoPath: "/tmp/avatar-render/audio-only.mp4",
          expectedDurationMs: 1200,
          contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
          fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
        },
        {
          statFile: async () => ({
            size: AVATAR_RENDER_MIN_OUTPUT_BYTES + 1,
            isFile: () => true,
          }),
          readFile: async () => Buffer.alloc(AVATAR_RENDER_MIN_OUTPUT_BYTES + 1, 1),
          probeVideo: async () => ({
            durationMs: 0,
            videoStreamCount: 0,
          }),
        }
      )
    ).rejects.toMatchObject({
      code: AVATAR_RENDER_ERROR_CODES.invalidProviderOutput,
    } satisfies Partial<AvatarRenderOutputValidationError>);
  });

  it("runs ffprobe with structured args and parses duration plus video streams", async () => {
    const commandRunner = vi.fn(async () => ({
      stdout: JSON.stringify({
        streams: [{ codec_type: "video", codec_name: "h264" }],
        format: { duration: "1.234" },
      }),
      stderr: "",
    }));
    const probeVideo = createFfprobeVideoProbe({
      command: "/opt/homebrew/bin/ffprobe",
      commandRunner,
    });

    const result = await probeVideo("/tmp/avatar-render/output.mp4");

    expect(commandRunner).toHaveBeenCalledWith(
      "/opt/homebrew/bin/ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_type,codec_name:format=duration",
        "-of",
        "json",
        "/tmp/avatar-render/output.mp4",
      ],
      expect.objectContaining({ timeoutMs: expect.any(Number) })
    );
    expect(result).toEqual({
      durationMs: 1234,
      videoStreamCount: 1,
      codecName: "h264",
    });
  });
});
