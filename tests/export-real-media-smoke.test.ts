import { describe, expect, it } from "vitest";
import { runRealMediaExportSmoke } from "@/services/exportMediaSmokeService";

describe("real media export smoke", () => {
  it(
    "generates a 9:16 MP4 with real FFmpeg and verifies video/audio streams with ffprobe",
    async () => {
      const result = await runRealMediaExportSmoke({
        durationSeconds: 1.2,
        outputProfile: "mp4_1080p",
      });

      expect(result.validation).toEqual({ valid: true });
      expect(result.output.sizeBytes).toBeGreaterThan(0);
      expect(result.output.width).toBe(1080);
      expect(result.output.height).toBe(1920);
      expect(result.output.durationSeconds).toBeGreaterThan(0);
      expect(result.output.hasVideoStream).toBe(true);
      expect(result.output.hasAudioStream).toBe(true);
    },
    30_000
  );
});
