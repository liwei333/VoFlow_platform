import { describe, expect, it, vi } from "vitest";
import {
  buildAssSubtitle,
  buildSrtSubtitle,
  splitSubtitleText,
} from "@/lib/export/subtitle";
import {
  createAssSubtitleArtifactForJob,
  createSubtitleArtifactForJob,
} from "@/services/exportSubtitleService";

describe("export subtitle generation", () => {
  it("splits confirmed script content by punctuation and max length", () => {
    expect(
      splitSubtitleText("开场第一句。第二句需要继续讲清楚卖点和使用场景，避免单条字幕太长。收尾！", {
        maxCharsPerCue: 16,
      })
    ).toEqual([
      "开场第一句。",
      "第二句需要继续讲清楚卖点和使用场",
      "景，避免单条字幕太长。",
      "收尾！",
    ]);
  });

  it("builds deterministic SRT cues from confirmed script content", () => {
    expect(
      buildSrtSubtitle("第一句。第二句。", {
        maxCharsPerCue: 12,
        minCueDurationMs: 1200,
        maxCueDurationMs: 2400,
        charsPerSecond: 8,
      })
    ).toEqual(
      [
        "1",
        "00:00:00,000 --> 00:00:01,200",
        "第一句。",
        "",
        "2",
        "00:00:01,200 --> 00:00:02,400",
        "第二句。",
        "",
      ].join("\n")
    );
  });

  it("builds an ASS subtitle template with 9:16 safe style defaults", () => {
    const ass = buildAssSubtitle("第一句。第二句。", {
      maxCharsPerCue: 12,
      minCueDurationMs: 1200,
      maxCueDurationMs: 2400,
      charsPerSecond: 8,
    });

    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain(
      "Style: Default,Noto Sans CJK SC,52,&H00FFFFFF,&H000000FF,&H00000000,&H64000000"
    );
    expect(ass).toContain(",2,72,72,300,");
    expect(ass).toContain("[Events]");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:01.20,Default,,0,0,0,,第一句。");
    expect(ass).toContain("Dialogue: 0,0:00:01.20,0:00:02.40,Default,,0,0,0,,第二句。");
  });

  it("uploads a subtitle artifact from the latest succeeded TTS request", async () => {
    const uploadSubtitle = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/subtitle/subtitle.srt");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-subtitle-1",
      jobId: "job-1",
      nodeId: "node-subtitle-1",
      type: "subtitle",
      storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.srt",
      metadata: {
        format: "srt",
        sourceScriptCandidateId: "candidate-1",
        audioArtifactId: "audio-artifact-1",
        segmentCount: 2,
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await createSubtitleArtifactForJob(
      {
        jobId: "job-1",
        teamId: "team-1",
        nodeId: "node-subtitle-1",
      },
      {
        repository: {
          async findSubtitleSource(input) {
            expect(input).toEqual({ jobId: "job-1", teamId: "team-1" });
            return {
              jobId: "job-1",
              teamId: "team-1",
              scriptCandidateId: "candidate-1",
              scriptContent: "第一句。第二句。",
              audioArtifactId: "audio-artifact-1",
            };
          },
        },
        uploadSubtitle,
        writeArtifact,
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        artifact: {
          id: "artifact-subtitle-1",
          type: "subtitle",
        },
        segmentCount: 2,
      },
    });
    expect(uploadSubtitle).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        jobId: "job-1",
        nodeType: "subtitle",
        fileName: "subtitle.srt",
        contentType: "application/x-subrip",
        size: expect.any(Number),
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        nodeId: "node-subtitle-1",
        type: "subtitle",
        storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.srt",
        metadata: expect.objectContaining({
          format: "srt",
          sourceScriptCandidateId: "candidate-1",
          audioArtifactId: "audio-artifact-1",
          segmentCount: 2,
        }),
      })
    );
  });

  it("uploads an ASS subtitle artifact with the shared 9:16 style template", async () => {
    const uploadSubtitle = vi.fn().mockResolvedValue("voflow/team/jobs/job-1/subtitle/subtitle.ass");
    const writeArtifact = vi.fn().mockResolvedValue({
      id: "artifact-subtitle-ass-1",
      jobId: "job-1",
      nodeId: "node-subtitle-1",
      type: "subtitle",
      storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.ass",
      metadata: {
        format: "ass",
        sourceScriptCandidateId: "candidate-1",
        audioArtifactId: "audio-artifact-1",
        segmentCount: 2,
      },
      createdAt: new Date("2026-06-24T00:00:00.000Z"),
    });

    const result = await createAssSubtitleArtifactForJob(
      {
        jobId: "job-1",
        teamId: "team-1",
        nodeId: "node-subtitle-1",
      },
      {
        repository: {
          async findSubtitleSource() {
            return {
              jobId: "job-1",
              teamId: "team-1",
              scriptCandidateId: "candidate-1",
              scriptContent: "第一句。第二句。",
              audioArtifactId: "audio-artifact-1",
            };
          },
        },
        uploadSubtitle,
        writeArtifact,
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        artifact: {
          id: "artifact-subtitle-ass-1",
          type: "subtitle",
        },
        subtitleContent: expect.stringContaining("[V4+ Styles]"),
      },
    });
    expect(uploadSubtitle).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "subtitle.ass",
        contentType: "text/x-ass",
      })
    );
    expect(writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "subtitle",
        metadata: expect.objectContaining({
          format: "ass",
          sourceScriptCandidateId: "candidate-1",
          audioArtifactId: "audio-artifact-1",
          segmentCount: 2,
        }),
      })
    );
  });

  it("rejects subtitle generation when no succeeded TTS audio exists", async () => {
    const result = await createSubtitleArtifactForJob(
      {
        jobId: "job-missing-audio",
        teamId: "team-1",
        nodeId: "node-subtitle-1",
      },
      {
        repository: {
          async findSubtitleSource() {
            return null;
          },
        },
        uploadSubtitle: vi.fn(),
        writeArtifact: vi.fn(),
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "SUBTITLE_SOURCE_NOT_FOUND",
        message: "缺少已确认文案或 TTS 音频",
      },
    });
  });
});
