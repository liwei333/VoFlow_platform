import { describe, expect, it, vi } from "vitest";
import { buildBgmMixFfmpegArgs } from "@/lib/export/audio-mix";
import { createMixedAudioArtifact } from "@/services/exportAudioMixService";

describe("export audio mixing", () => {
  it("builds a voice-first FFmpeg command with BGM ducking and fades", () => {
    expect(
      buildBgmMixFfmpegArgs({
        voiceAudioPath: "/tmp/voice.wav",
        bgmAudioPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/mixed.wav",
        durationSeconds: 12,
        voiceVolume: 100,
        bgmVolume: 35,
      })
    ).toEqual([
      "-y",
      "-i",
      "/tmp/voice.wav",
      "-stream_loop",
      "-1",
      "-i",
      "/tmp/bgm.mp3",
      "-filter_complex",
      "[0:a]volume=1.00[voice];[1:a]volume=0.35,afade=t=in:st=0:d=1.5,afade=t=out:st=10.5:d=1.5[bgm];[bgm][voice]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=250[ducked];[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0[mixed]",
      "-map",
      "[mixed]",
      "-t",
      "12.000",
      "-c:a",
      "pcm_s16le",
      "/tmp/mixed.wav",
    ]);
  });

  it("runs FFmpeg, uploads mixed audio, and writes a mixed_audio artifact", async () => {
    const executeFfmpeg = vi.fn().mockResolvedValue(undefined);
    const readOutputFile = vi.fn().mockResolvedValue(Buffer.from("mixed-audio"));
    const uploadMixedAudio = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-mixed-audio-1",
      jobId: "job-1",
      nodeId: "node-bgm-mix-1",
      type: "mixed_audio",
      storageUrl: "voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav",
      metadata: {
        voiceAudioArtifactId: "voice-artifact-1",
        bgmAssetId: "bgm-1",
        durationSeconds: 12,
        voiceVolume: 100,
        bgmVolume: 35,
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await createMixedAudioArtifact(
      {
        teamId: "team-1",
        jobId: "job-1",
        nodeId: "node-bgm-mix-1",
        voiceAudioArtifactId: "voice-artifact-1",
        bgmAssetId: "bgm-1",
        voiceAudioPath: "/tmp/voice.wav",
        bgmAudioPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/mixed.wav",
        durationSeconds: 12,
        voiceVolume: 100,
        bgmVolume: 35,
      },
      {
        executeFfmpeg,
        readOutputFile,
        uploadMixedAudio,
        writeArtifact,
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        artifact: {
          id: "artifact-mixed-audio-1",
          type: "mixed_audio",
        },
      },
    });
    expect(executeFfmpeg).toHaveBeenCalledWith(expect.arrayContaining(["-filter_complex"]));
    expect(readOutputFile).toHaveBeenCalledWith("/tmp/mixed.wav");
    expect(uploadMixedAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        jobId: "job-1",
        nodeType: "bgm_mix",
        fileName: "mixed_audio.wav",
        contentType: "audio/wav",
        size: Buffer.byteLength("mixed-audio"),
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        nodeId: "node-bgm-mix-1",
        type: "mixed_audio",
        storageUrl: "voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav",
        metadata: expect.objectContaining({
          voiceAudioArtifactId: "voice-artifact-1",
          bgmAssetId: "bgm-1",
          durationSeconds: 12,
          voiceVolume: 100,
          bgmVolume: 35,
        }),
      })
    );
  });

  it("returns a stable error when FFmpeg mixing fails", async () => {
    const result = await createMixedAudioArtifact(
      {
        teamId: "team-1",
        jobId: "job-1",
        nodeId: "node-bgm-mix-1",
        voiceAudioArtifactId: "voice-artifact-1",
        bgmAssetId: "bgm-1",
        voiceAudioPath: "/tmp/voice.wav",
        bgmAudioPath: "/tmp/bgm.mp3",
        outputPath: "/tmp/mixed.wav",
        durationSeconds: 12,
      },
      {
        executeFfmpeg: vi.fn().mockRejectedValue(new Error("ffmpeg failed")),
        readOutputFile: vi.fn(),
        uploadMixedAudio: vi.fn(),
        writeArtifact: vi.fn(),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "BGM_MIX_FAILED",
        message: "ffmpeg failed",
      },
    });
  });
});
