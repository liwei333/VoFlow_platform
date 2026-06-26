import { describe, expect, it, vi } from "vitest";
import { createFinalVideoDownloadUrl } from "@/services/exportDownloadService";

describe("final video download service", () => {
  it("generates a short-lived URL and writes audit log for team-owned final video", async () => {
    const generateDownloadUrl = vi.fn().mockResolvedValue("https://download.example/final.mp4");
    const writeDownloadAuditLog = vi.fn().mockResolvedValue(undefined);

    const result = await createFinalVideoDownloadUrl(
      {
        artifactId: "artifact-final-video-1",
        teamId: "team-1",
        userId: "user-1",
      },
      {
        repository: {
          async findDownloadableArtifact(input) {
            expect(input).toEqual({
              artifactId: "artifact-final-video-1",
              teamId: "team-1",
            });
            return {
              id: "artifact-final-video-1",
              jobId: "job-1",
              type: "final_video",
              storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
            };
          },
        },
        generateDownloadUrl,
        writeDownloadAuditLog,
      }
    );

    expect(result).toEqual({
      success: true,
      data: {
        artifactId: "artifact-final-video-1",
        downloadUrl: "https://download.example/final.mp4",
        expiresInSeconds: 300,
      },
    });
    expect(generateDownloadUrl).toHaveBeenCalledWith(
      "voflow/team/jobs/job-1/final_export/final_video.mp4",
      300
    );
    expect(writeDownloadAuditLog).toHaveBeenCalledWith({
      teamId: "team-1",
      userId: "user-1",
      artifactId: "artifact-final-video-1",
      jobId: "job-1",
      storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
    });
  });

  it("rejects missing, cross-team, or non-final-video artifacts", async () => {
    await expect(
      createFinalVideoDownloadUrl(
        {
          artifactId: "artifact-missing",
          teamId: "team-1",
          userId: "user-1",
        },
        {
          repository: {
            async findDownloadableArtifact() {
              return null;
            },
          },
          generateDownloadUrl: vi.fn(),
          writeDownloadAuditLog: vi.fn(),
        }
      )
    ).resolves.toEqual({
      success: false,
      error: {
        code: "FINAL_VIDEO_NOT_FOUND",
        message: "最终视频不存在",
      },
    });

    await expect(
      createFinalVideoDownloadUrl(
        {
          artifactId: "artifact-subtitle",
          teamId: "team-1",
          userId: "user-1",
        },
        {
          repository: {
            async findDownloadableArtifact() {
              return {
                id: "artifact-subtitle",
                jobId: "job-1",
                type: "subtitle",
                storageUrl: "voflow/team/jobs/job-1/subtitle/subtitle.ass",
              };
            },
          },
          generateDownloadUrl: vi.fn(),
          writeDownloadAuditLog: vi.fn(),
        }
      )
    ).resolves.toEqual({
      success: false,
      error: {
        code: "FINAL_VIDEO_NOT_FOUND",
        message: "最终视频不存在",
      },
    });
  });
});
