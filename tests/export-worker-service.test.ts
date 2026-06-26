import { describe, expect, it, vi } from "vitest";
import { buildFinalVideoFfmpegArgs } from "@/lib/export/final-video";
import {
  createDefaultWorkflowNodeHandlers,
} from "@/services/workflowWorkerService";
import { createFinalExportWorkflowNodeHandler } from "@/services/exportWorkerService";

describe("final export worker", () => {
  it("registers final_export in the default workflow handlers", () => {
    expect(createDefaultWorkflowNodeHandlers().final_export).toEqual(expect.any(Function));
  });

  it("builds a final MP4 FFmpeg command with video, audio, subtitles, and output profile", () => {
    expect(
      buildFinalVideoFfmpegArgs({
        avatarVideoPath: "/tmp/avatar.mp4",
        audioPath: "/tmp/audio.wav",
        subtitlePath: "/tmp/subtitle.ass",
        outputPath: "/tmp/final.mp4",
        outputProfile: "mp4_1080p",
      })
    ).toEqual([
      "-y",
      "-i",
      "/tmp/avatar.mp4",
      "-i",
      "/tmp/audio.wav",
      "-vf",
      "scale=1080:1920,subtitles='/tmp/subtitle.ass'",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "/tmp/final.mp4",
    ]);
  });

  it("uploads final_video artifact and marks export request succeeded", async () => {
    const materializeObject = vi
      .fn()
      .mockResolvedValueOnce("/tmp/avatar.mp4")
      .mockResolvedValueOnce("/tmp/audio.wav")
      .mockResolvedValueOnce("/tmp/subtitle.ass");
    const executeFfmpeg = vi.fn().mockResolvedValue(undefined);
    const readOutputFile = vi.fn().mockResolvedValue(Buffer.from("final-video"));
    const validateFinalVideo = vi.fn().mockResolvedValue({ valid: true });
    const uploadFinalVideo = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/final_export/final_video.mp4");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-final-video-1",
      jobId: "job-1",
      nodeId: "node-final-export-1",
      type: "final_video",
      storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
      metadata: {
        exportRequestId: "export-request-1",
        outputProfile: "mp4_1080p",
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });
    const markExportRequestSucceeded = vi.fn().mockResolvedValue(undefined);

    const handler = createFinalExportWorkflowNodeHandler({
      repository: {
        async findExportRequestForWorker(input) {
          expect(input).toEqual({
            exportRequestId: "export-request-1",
            jobId: "job-1",
          });
          return {
            id: "export-request-1",
            jobId: "job-1",
            outputProfile: "mp4_1080p",
            job: {
              teamId: "team-1",
            },
            avatarVideoArtifact: {
              id: "avatar-video-artifact-1",
              storageUrl: "voflow/team/jobs/job-1/avatar_render/avatar.mp4",
            },
            audioArtifact: {
              id: "audio-artifact-1",
              storageUrl: "voflow/team/jobs/job-1/bgm_mix/mixed_audio.wav",
            },
            subtitleArtifact: {
              id: "subtitle-artifact-1",
              storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.ass",
            },
            editingConfig: {
              id: "editing-config-1",
              configJson: {
                keywordHighlight: {
                  enabled: true,
                },
              },
            },
            bgmAssetId: "bgm-1",
            coverArtifactId: "cover-artifact-1",
          };
        },
        markExportRequestSucceeded,
        markExportRequestFailed: vi.fn(),
      },
      materializeObject,
      executeFfmpeg,
      readOutputFile,
      validateFinalVideo,
      uploadFinalVideo,
      writeArtifact,
      buildOutputPath: () => "/tmp/final.mp4",
    });

    const result = await handler({
      payload: {
        jobId: "job-1",
        nodeId: "node-final-export-1",
        nodeType: "final_export",
        version: 1,
        traceId: "trace-final-export",
      },
      input: {
        exportRequestId: "export-request-1",
      },
    });

    expect(result.output).toMatchObject({
      exportRequestId: "export-request-1",
      finalVideoArtifactId: "artifact-final-video-1",
      outputProfile: "mp4_1080p",
    });
    expect(executeFfmpeg).toHaveBeenCalledWith(expect.arrayContaining(["-movflags", "+faststart"]));
    expect(validateFinalVideo).toHaveBeenCalledWith({
      filePath: "/tmp/final.mp4",
      sizeBytes: Buffer.byteLength("final-video"),
      expectedDurationSeconds: null,
    });
    expect(uploadFinalVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        jobId: "job-1",
        nodeType: "final_export",
        fileName: "final_video.mp4",
        contentType: "video/mp4",
        size: Buffer.byteLength("final-video"),
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        nodeId: "node-final-export-1",
        type: "final_video",
        storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
      })
    );
    expect(markExportRequestSucceeded).toHaveBeenCalledWith({
      exportRequestId: "export-request-1",
      finalVideoArtifactId: "artifact-final-video-1",
    });
  });
});
