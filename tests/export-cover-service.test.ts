import { describe, expect, it, vi } from "vitest";
import {
  buildCoverFrameFfmpegArgs,
  buildCoverTitleFfmpegArgs,
  resolveCoverTitleText,
} from "@/lib/export/cover";
import {
  createCoverBaseArtifact,
  createCoverTitleArtifact,
} from "@/services/exportCoverService";

describe("export cover frame extraction", () => {
  it("builds an FFmpeg command that extracts a middle frame", () => {
    expect(
      buildCoverFrameFfmpegArgs({
        videoPath: "/tmp/avatar.mp4",
        outputPath: "/tmp/cover.jpg",
        durationSeconds: 10,
      })
    ).toEqual([
      "-y",
      "-ss",
      "5.000",
      "-i",
      "/tmp/avatar.mp4",
      "-frames:v",
      "1",
      "-q:v",
      "2",
      "/tmp/cover.jpg",
    ]);
  });

  it("runs FFmpeg, uploads cover image, and writes a cover artifact", async () => {
    const executeFfmpeg = vi.fn().mockResolvedValue(undefined);
    const readOutputFile = vi.fn().mockResolvedValue(Buffer.from("cover-image"));
    const uploadCover = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/cover/cover_base.jpg");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-cover-1",
      jobId: "job-1",
      nodeId: "node-cover-1",
      type: "cover",
      storageUrl: "voflow/team/jobs/job-1/cover/cover_base.jpg",
      metadata: {
        avatarVideoArtifactId: "avatar-video-artifact-1",
        frameTimeSeconds: 5,
        stage: "base_frame",
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await createCoverBaseArtifact(
      {
        teamId: "team-1",
        jobId: "job-1",
        nodeId: "node-cover-1",
        avatarVideoArtifactId: "avatar-video-artifact-1",
        videoPath: "/tmp/avatar.mp4",
        outputPath: "/tmp/cover.jpg",
        durationSeconds: 10,
      },
      {
        executeFfmpeg,
        readOutputFile,
        uploadCover,
        writeArtifact,
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        artifact: {
          id: "artifact-cover-1",
          type: "cover",
        },
        frameTimeSeconds: 5,
      },
    });
    expect(executeFfmpeg).toHaveBeenCalledWith(expect.arrayContaining(["-frames:v", "1"]));
    expect(readOutputFile).toHaveBeenCalledWith("/tmp/cover.jpg");
    expect(uploadCover).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        jobId: "job-1",
        nodeType: "cover",
        fileName: "cover_base.jpg",
        contentType: "image/jpeg",
        size: Buffer.byteLength("cover-image"),
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        nodeId: "node-cover-1",
        type: "cover",
        storageUrl: "voflow/team/jobs/job-1/cover/cover_base.jpg",
        metadata: expect.objectContaining({
          avatarVideoArtifactId: "avatar-video-artifact-1",
          frameTimeSeconds: 5,
          stage: "base_frame",
        }),
      })
    );
  });

  it("resolves cover title from title candidates or fallback script text", () => {
    expect(
      resolveCoverTitleText({
        titleCandidates: ["爆款标题一", "标题二"],
        scriptContent: "这是一个很长的脚本文案",
      })
    ).toBe("爆款标题一");
    expect(
      resolveCoverTitleText({
        titleCandidates: null,
        scriptContent: "这是一个很长的脚本文案，应该被截断成封面标题。",
      })
    ).toBe("这是一个很长的脚本文案，应该被截断成封面");
  });

  it("builds an FFmpeg command that overlays title text on cover image", () => {
    const args = buildCoverTitleFfmpegArgs({
      baseImagePath: "/tmp/cover_base.jpg",
      outputPath: "/tmp/cover_title.jpg",
      titleText: "爆款标题",
    });

    expect(args).toEqual([
      "-y",
      "-i",
      "/tmp/cover_base.jpg",
      "-vf",
      "drawbox=x=0:y=1320:w=iw:h=360:color=black@0.45:t=fill,drawtext=text='爆款标题':fontcolor=white:fontsize=64:line_spacing=12:x=(w-text_w)/2:y=h-420",
      "-frames:v",
      "1",
      "/tmp/cover_title.jpg",
    ]);
  });

  it("composes a title cover artifact from a base cover image", async () => {
    const executeFfmpeg = vi.fn().mockResolvedValue(undefined);
    const readOutputFile = vi.fn().mockResolvedValue(Buffer.from("cover-title"));
    const uploadCover = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/cover/cover_title.jpg");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-cover-title-1",
      jobId: "job-1",
      nodeId: "node-cover-1",
      type: "cover",
      storageUrl: "voflow/team/jobs/job-1/cover/cover_title.jpg",
      metadata: {
        baseCoverArtifactId: "artifact-cover-1",
        titleText: "爆款标题",
        stage: "title_frame",
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await createCoverTitleArtifact(
      {
        teamId: "team-1",
        jobId: "job-1",
        nodeId: "node-cover-1",
        baseCoverArtifactId: "artifact-cover-1",
        baseImagePath: "/tmp/cover_base.jpg",
        outputPath: "/tmp/cover_title.jpg",
        titleText: "爆款标题",
      },
      {
        executeFfmpeg,
        readOutputFile,
        uploadCover,
        writeArtifact,
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        artifact: {
          id: "artifact-cover-title-1",
          type: "cover",
        },
      },
    });
    expect(executeFfmpeg).toHaveBeenCalledWith(expect.arrayContaining(["-vf"]));
    expect(uploadCover).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "cover_title.jpg",
        contentType: "image/jpeg",
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "cover",
        metadata: expect.objectContaining({
          baseCoverArtifactId: "artifact-cover-1",
          titleText: "爆款标题",
          stage: "title_frame",
        }),
      })
    );
  });

  it("returns a stable error when cover extraction fails", async () => {
    const result = await createCoverBaseArtifact(
      {
        teamId: "team-1",
        jobId: "job-1",
        nodeId: "node-cover-1",
        avatarVideoArtifactId: "avatar-video-artifact-1",
        videoPath: "/tmp/avatar.mp4",
        outputPath: "/tmp/cover.jpg",
        durationSeconds: 10,
      },
      {
        executeFfmpeg: vi.fn().mockRejectedValue(new Error("ffmpeg failed")),
        readOutputFile: vi.fn(),
        uploadCover: vi.fn(),
        writeArtifact: vi.fn(),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "COVER_FRAME_EXTRACTION_FAILED",
        message: "ffmpeg failed",
      },
    });
  });
});
