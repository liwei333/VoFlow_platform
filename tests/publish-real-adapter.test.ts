import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildPublishRealPlatformConfig } from "@/lib/publish/config";
import { encryptChannelToken } from "@/lib/publish/token";
import { POST as syncPOST } from "@/app/api/publishes/[publishId]/sync/route";
import { createYoutubeChannelAdapter } from "@/lib/publish/youtube-adapter";
import { resolveFinalVideoArtifact } from "@/services/finalVideoArtifactService";
import { createPublishesForJob } from "@/services/publishService";
import { syncPublishStatus } from "@/services/publishStatusSyncService";

const realPublishEnv = {
  PUBLISH_REAL_ADAPTER_ENABLED: "true",
  PUBLISH_REAL_PROVIDER: "youtube",
  PUBLISH_ALLOW_MOCK_ADAPTER: "false",
  CHANNEL_TOKEN_ENCRYPTION_SECRET: "test-real-publish-secret",
  YOUTUBE_CLIENT_ID: "youtube-client-id",
  YOUTUBE_CLIENT_SECRET: "youtube-client-secret",
  YOUTUBE_REDIRECT_URI: "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
  YOUTUBE_API_BASE_URL: "https://www.googleapis.com/youtube/v3",
  YOUTUBE_UPLOAD_BASE_URL: "https://www.googleapis.com/upload/youtube/v3",
};

describe("real publish adapter and status sync", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let nodeId: string;
  let artifactId: string;
  let draftId: string;
  let accountId: string;
  let publishId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `real_publish_adapter_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Real Publish Adapter User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Real Publish Adapter Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Real Publish Adapter Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.createMany({
      data: [
        { teamId, userId, role: "owner" },
        { teamId: otherTeamId, userId, role: "member" },
      ],
    });

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Real Publish Adapter Project",
        targetPlatform: "youtube_shorts",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "succeeded",
      },
    });
    jobId = job.id;

    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "final_export",
        status: "succeeded",
        version: 1,
      },
    });
    nodeId = node.id;

    const artifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId,
        type: "final_video",
        storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
        metadata: {
          contentType: "video/mp4",
          sizeBytes: 12,
          durationSeconds: 30,
          width: 1080,
          height: 1920,
        },
      },
    });
    artifactId = artifact.id;

    const draft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "youtube_shorts",
        title: "YouTube Shorts title",
        description: "YouTube description",
        tagsJson: ["shorts", "voflow"],
        topicsJson: [],
        validationJson: {
          platform: "youtube_shorts",
          passed: true,
          checks: [],
        },
      },
    });
    draftId = draft.id;

    const account = await prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: "youtube_shorts",
        provider: "youtube",
        providerAccountId: "youtube-channel-id",
        accountName: "YouTube Channel",
        encryptedAccessToken: "encrypted-access-token-not-used-in-unit-test",
        status: "connected",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    accountId = account.id;

    const publish = await prisma.publish.create({
      data: {
        jobId,
        publishDraftId: draftId,
        channelAccountId: accountId,
        platform: "youtube_shorts",
        status: "uploading",
        requestId: "youtube-video-id",
        remoteId: "youtube-video-id",
      },
    });
    publishId = publish.id;
  });

  afterEach(async () => {
    await prisma.publish.deleteMany({ where: { jobId } });
    await prisma.publishDraft.deleteMany({ where: { jobId } });
    await prisma.channelAccount.deleteMany({ where: { teamId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [{ teamId }, { teamId: otherTeamId }, { userId }],
      },
    });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    vi.restoreAllMocks();
  });

  it("resolves a final_video artifact for the current team and job", async () => {
    const result = await resolveFinalVideoArtifact(
      {
        teamId,
        jobId,
      },
      {
        downloadObject: vi.fn(async () => Readable.from([Buffer.from("mp4")])) ,
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.artifact).toMatchObject({
      id: artifactId,
      jobId,
      storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
      contentType: "video/mp4",
      sizeBytes: 12,
    });
  });

  it("rejects final_video resolution across teams", async () => {
    const downloadObject = vi.fn(async () => Readable.from([Buffer.from("mp4")]));
    const result = await resolveFinalVideoArtifact(
      {
        teamId: otherTeamId,
        jobId,
      },
      {
        downloadObject,
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "PUBLISH_FINAL_VIDEO_NOT_FOUND",
        message: "最终 MP4 产物不存在",
      },
    });
    expect(downloadObject).not.toHaveBeenCalled();
  });

  it("uploads a YouTube video with resumable upload and stable remote ids", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            Location: "https://upload.youtube.test/session",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "youtube-video-id",
          status: {
            uploadStatus: "uploaded",
            privacyStatus: "private",
          },
        })
      );
    const adapter = createYoutubeChannelAdapter({
      accessToken: "youtube-access-token",
      config: buildPublishRealPlatformConfig(realPublishEnv),
      fetchImpl,
    });

    const result = await adapter.uploadVideo({
      platform: "youtube_shorts",
      publishDraftId: draftId,
      channelAccountId: accountId,
      finalVideoArtifactId: artifactId,
      finalVideo: {
        id: artifactId,
        storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
        contentType: "video/mp4",
        sizeBytes: 12,
        stream: Readable.from([Buffer.from("fake-mp4")]),
      },
      title: "YouTube Shorts title",
      description: "YouTube description",
      tags: ["shorts", "voflow"],
      topics: [],
      coverArtifactId: null,
      validationJson: {
        platform: "youtube_shorts",
        passed: true,
        checks: [],
      },
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        provider: "youtube",
        platform: "youtube_shorts",
        requestId: "youtube-video-id",
        remoteVideoId: "youtube-video-id",
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/upload/youtube/v3/videos");
    expect(String(fetchImpl.mock.calls[0][0])).toContain("uploadType=resumable");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer youtube-access-token"
    );
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain("encrypted-access-token");
  });

  it("creates real YouTube publishes from final_video without using mock adapter", async () => {
    await prisma.channelAccount.update({
      where: {
        id: accountId,
      },
      data: {
        encryptedAccessToken: encryptChannelToken(
          "youtube-access-token",
          realPublishEnv.CHANNEL_TOKEN_ENCRYPTION_SECRET
        ),
        encryptedToken: encryptChannelToken(
          "youtube-access-token",
          realPublishEnv.CHANNEL_TOKEN_ENCRYPTION_SECRET
        ),
      },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            Location: "https://upload.youtube.test/session",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "youtube-video-id-created",
          status: {
            uploadStatus: "uploaded",
            privacyStatus: "private",
          },
        })
      );

    const result = await createPublishesForJob(
      {
        jobId,
        teamId,
        userId,
        platforms: ["youtube_shorts"],
      },
      {
        env: realPublishEnv,
        fetchImpl,
        downloadObject: vi.fn(async () => Readable.from([Buffer.from("fake-mp4")])) ,
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.publishes[0]).toMatchObject({
      platform: "youtube_shorts",
      status: "published",
      requestId: "youtube-video-id-created",
      remoteId: "youtube-video-id-created",
      remoteUrl: "https://www.youtube.com/watch?v=youtube-video-id-created",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("youtube-access-token");
  });

  it("syncs remote YouTube status into the publish record", async () => {
    const adapter = createYoutubeChannelAdapter({
      accessToken: "youtube-access-token",
      config: buildPublishRealPlatformConfig(realPublishEnv),
      fetchImpl: vi.fn().mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "youtube-video-id",
              status: {
                uploadStatus: "processed",
                privacyStatus: "private",
              },
            },
          ],
        })
      ),
    });

    const result = await syncPublishStatus(
      {
        publishId,
        teamId,
        userId,
        now: new Date("2026-06-26T02:00:00.000Z"),
      },
      {
        adapter,
      }
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.publish).toMatchObject({
      id: publishId,
      status: "published",
      remoteUrl: "https://www.youtube.com/watch?v=youtube-video-id",
      lastSyncedAt: "2026-06-26T02:00:00.000Z",
    });

    const saved = await prisma.publish.findUniqueOrThrow({ where: { id: publishId } });
    expect(saved.status).toBe("published");
    expect(saved.remoteUrl).toBe("https://www.youtube.com/watch?v=youtube-video-id");
    expect(saved.lastSyncedAt?.toISOString()).toBe("2026-06-26T02:00:00.000Z");
    expect(saved.remoteStatus).toMatchObject({
      uploadStatus: "processed",
      privacyStatus: "private",
    });
  });

  it("stores a sanitized status sync failure without leaking token values", async () => {
    const adapter = {
      platform: "youtube_shorts" as const,
      provider: "youtube" as const,
      isMock: false,
      uploadVideo: vi.fn(),
      publish: vi.fn(),
      retry: vi.fn(),
      getStatus: vi.fn().mockResolvedValueOnce({
        success: false,
        error: {
          code: "PUBLISH_STATUS_SYNC_FAILED",
          message:
            "remote rejected Bearer youtube-access-token youtube-client-secret",
        },
      }),
    };

    const result = await syncPublishStatus(
      {
        publishId,
        teamId,
        userId,
        now: new Date("2026-06-26T02:30:00.000Z"),
      },
      {
        adapter,
      }
    );

    expect(result).toEqual({
      success: false,
      error: {
        code: "PUBLISH_STATUS_SYNC_FAILED",
        message: "发布状态同步失败",
      },
    });
    expect(JSON.stringify(result)).not.toContain("youtube-access-token");
    expect(JSON.stringify(result)).not.toContain("youtube-client-secret");

    const saved = await prisma.publish.findUniqueOrThrow({ where: { id: publishId } });
    expect(saved.status).toBe("failed");
    expect(saved.lastSyncedAt?.toISOString()).toBe("2026-06-26T02:30:00.000Z");
    expect(saved.errorJson).toEqual({
      code: "PUBLISH_STATUS_SYNC_FAILED",
      message: "发布状态同步失败",
    });
  });

  it("refreshes remote publish status through the manual sync API", async () => {
    for (const [key, value] of Object.entries(realPublishEnv)) {
      vi.stubEnv(key, value);
    }
    await prisma.channelAccount.update({
      where: {
        id: accountId,
      },
      data: {
        encryptedAccessToken: encryptChannelToken(
          "youtube-access-token",
          realPublishEnv.CHANNEL_TOKEN_ENCRYPTION_SECRET
        ),
        encryptedToken: encryptChannelToken(
          "youtube-access-token",
          realPublishEnv.CHANNEL_TOKEN_ENCRYPTION_SECRET
        ),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "youtube-video-id",
              status: {
                uploadStatus: "processed",
                privacyStatus: "private",
              },
            },
          ],
        })
      )
    );

    const response = await syncPOST(await createAuthenticatedRequest(), {
      params: Promise.resolve({ publishId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "发布状态已同步",
      data: {
        publish: {
          id: publishId,
          status: "published",
          remoteUrl: "https://www.youtube.com/watch?v=youtube-video-id",
        },
      },
    });
  });

  async function createAuthenticatedRequest(): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "real-publish-adapter@example.com",
      name: "Real Publish Adapter User",
      teamId,
    });
    const request = new NextRequest(`http://localhost/api/publishes/${publishId}/sync`, {
      method: "POST",
    });
    request.cookies.set("session", token);

    return request;
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
