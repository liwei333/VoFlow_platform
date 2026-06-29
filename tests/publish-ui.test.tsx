import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PublishPage from "@/app/dashboard/publish/page";
import {
  PublishDraftEditor,
  createPublishDraftFormState,
  parsePublishDelimitedText,
  type PublishDraftEditorViewModel,
} from "@/components/publish/PublishDraftEditor";
import { PublishCenterPanel } from "@/components/publish/PublishCenterPanel";
import { getPublishStatusLabel } from "@/lib/publish/ui";
import type { SerializedChannelAccount } from "@/lib/publish/channel-account";
import type { SerializedPublish } from "@/lib/publish/publish";
import type { PublishPlatformValidationResult } from "@/lib/publish/validation";

const baseDrafts: PublishDraftEditorViewModel[] = [
  {
    id: "draft_douyin",
    jobId: "job_1",
    platform: "douyin",
    title: "合规发布标题",
    description: "抖音发布描述",
    tags: ["新品", "口播"],
    topics: ["618"],
    coverArtifactId: "cover_1",
    validationJson: null,
    rule: {
      platform: "douyin",
      label: "抖音",
      title: { maxChars: 55 },
      tags: { maxCount: 5 },
      cover: {
        allowedAspectRatios: ["9:16", "16:9"],
        recommendedAspectRatio: "9:16",
      },
      video: {
        allowedAspectRatios: ["9:16", "16:9"],
        minDurationSeconds: 1,
        maxDurationSeconds: 900,
      },
    },
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
  },
  {
    id: "draft_xhs",
    jobId: "job_1",
    platform: "xiaohongshu",
    title: "小红书标题",
    description: "小红书发布描述",
    tags: ["生活"],
    topics: [],
    coverArtifactId: null,
    validationJson: null,
    rule: {
      platform: "xiaohongshu",
      label: "小红书",
      title: { maxChars: 20 },
      tags: { maxCount: 10 },
      cover: {
        allowedAspectRatios: ["3:4", "1:1", "4:3", "9:16"],
        recommendedAspectRatio: "3:4",
      },
      video: {
        allowedAspectRatios: ["9:16", "1:1", "3:4"],
        minDurationSeconds: 1,
        maxDurationSeconds: 300,
      },
    },
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
  },
];

describe("Publish draft UI", () => {
  it("renders the publish page as an editing workspace instead of a placeholder", () => {
    const html = renderToStaticMarkup(<PublishPage />);

    expect(html).toContain("发布中心");
    expect(html).toContain("发布信息编辑");
    expect(html).toContain("账号授权状态");
    expect(html).toContain("发布参数检查");
    expect(html).toContain("定时发布");
    expect(html).toContain("仅导出 MP4");
    expect(html).toContain("一键发布");
    expect(html).toContain("发布日志");
    expect(html).toContain("视频任务 ID");
    expect(html).toContain("加载发布草稿");
    expect(html).not.toContain("该功能正在开发中");
  });

  it("renders platform tabs, draft fields, and rule hints from draft.rule", () => {
    const html = renderToStaticMarkup(
      <PublishDraftEditor
        drafts={baseDrafts}
        savingDraftId={null}
        onSave={vi.fn()}
      />
    );

    expect(html).toContain("抖音");
    expect(html).toContain("小红书");
    expect(html).toContain("合规发布标题");
    expect(html).toContain("标题 6 / 55");
    expect(html).toContain("标签 2 / 5");
    expect(html).toContain("封面 Artifact ID");
    expect(html).toContain("推荐 9:16");
    expect(html).toContain("允许 9:16、16:9");
    expect(html).toContain("保存发布信息");
  });

  it("normalizes comma and newline separated tags without duplicates", () => {
    expect(parsePublishDelimitedText("新品, 口播，618\n新品")).toEqual([
      "新品",
      "口播",
      "618",
    ]);
  });

  it("creates an editable form state from a serialized publish draft", () => {
    expect(createPublishDraftFormState(baseDrafts[0])).toEqual({
      title: "合规发布标题",
      description: "抖音发布描述",
      tagsText: "新品, 口播",
      topicsText: "618",
      coverArtifactId: "cover_1",
    });
  });

  it("renders account state, validation results, publish actions, and retryable logs", () => {
    const accounts: SerializedChannelAccount[] = [
      {
        id: "acct_douyin",
        platform: "douyin",
        platformLabel: "抖音",
        status: "connected",
        statusLabel: "已授权",
        accountName: "抖音运营号",
        expiresAt: "2026-07-01T00:00:00.000Z",
        requiresAuth: false,
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "acct_xhs",
        platform: "xiaohongshu",
        platformLabel: "小红书",
        status: "expired",
        statusLabel: "授权已过期",
        accountName: "小红书运营号",
        expiresAt: "2026-06-01T00:00:00.000Z",
        requiresAuth: true,
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ];
    const validationResults: PublishPlatformValidationResult[] = [
      {
        draftId: "draft_douyin",
        platform: "douyin",
        passed: true,
        checkedAt: "2026-06-26T00:00:00.000Z",
        account: accounts[0],
        finalVideoArtifactId: "artifact_final",
        coverArtifactId: "cover_1",
        checks: [
          {
            code: "PUBLISH_TITLE_VALID",
            field: "title",
            passed: true,
            message: "标题符合平台限制",
          },
        ],
      },
      {
        draftId: "draft_xhs",
        platform: "xiaohongshu",
        passed: false,
        checkedAt: "2026-06-26T00:00:00.000Z",
        account: accounts[1],
        finalVideoArtifactId: "artifact_final",
        coverArtifactId: null,
        checks: [
          {
            code: "CHANNEL_TOKEN_EXPIRED",
            field: "channelAccount",
            passed: false,
            message: "渠道账号授权已过期",
          },
        ],
      },
    ];
    const publishes: SerializedPublish[] = [
      {
        id: "publish_failed",
        jobId: "job_1",
        publishDraftId: "draft_xhs",
        channelAccountId: "acct_xhs",
        platform: "xiaohongshu",
        status: "failed",
        requestId: "req_xhs",
        remoteId: null,
        errorJson: { message: "平台发布失败" },
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
    ];

    const html = renderToStaticMarkup(
      <PublishCenterPanel
        accounts={accounts}
        validationResults={validationResults}
        publishes={publishes}
        selectedPlatforms={["douyin", "xiaohongshu"]}
        scheduleAt=""
        checking={false}
        publishing={false}
        exportingMp4={false}
        retryingPublishId={null}
        authorizingPlatform={null}
        onScheduleAtChange={vi.fn()}
        onRefreshAccounts={vi.fn()}
        onAuthorize={vi.fn()}
        onValidate={vi.fn()}
        onSaveDrafts={vi.fn()}
        onExportMp4={vi.fn()}
        onPublish={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("账号授权状态");
    expect(html).toContain("抖音运营号");
    expect(html).toContain("授权已过期");
    expect(html).toContain("重新授权");
    expect(html).toContain("发布参数检查");
    expect(html).toContain("1 / 2 平台可发布");
    expect(html).toContain("渠道账号授权已过期");
    expect(html).toContain("定时发布");
    expect(html).toContain("保存草稿");
    expect(html).toContain("仅导出 MP4");
    expect(html).toContain("一键发布");
    expect(html).toContain("发布日志");
    expect(html).toContain("req_xhs");
    expect(html).toContain("重试");
  });

  it("renders real provider account details and remote publish status", () => {
    const accounts: SerializedChannelAccount[] = [
      {
        id: "acct_youtube",
        platform: "youtube_shorts",
        platformLabel: "YouTube Shorts",
        provider: "youtube",
        providerAccountId: "channel-123",
        status: "connected",
        statusLabel: "已授权",
        accountName: "VoFlow Studio",
        scopes: [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly",
        ],
        metadata: { thumbnailUrl: "https://example.com/avatar.png" },
        expiresAt: "2026-07-01T00:00:00.000Z",
        lastAuthorizedAt: "2026-06-26T00:00:00.000Z",
        lastRefreshAt: "2026-06-26T01:00:00.000Z",
        lastErrorJson: null,
        requiresAuth: false,
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T01:00:00.000Z",
      },
      {
        id: "acct_mock",
        platform: "douyin",
        platformLabel: "抖音",
        provider: "mock",
        providerAccountId: null,
        status: "connected",
        statusLabel: "已授权",
        accountName: "本地测试号",
        scopes: [],
        metadata: null,
        expiresAt: null,
        lastAuthorizedAt: null,
        lastRefreshAt: null,
        lastErrorJson: null,
        requiresAuth: false,
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        id: "acct_expired",
        platform: "xiaohongshu",
        platformLabel: "小红书",
        provider: "youtube",
        providerAccountId: "channel-expired",
        status: "expired",
        statusLabel: "授权已过期",
        accountName: "过期账号",
        scopes: ["https://www.googleapis.com/auth/youtube.upload"],
        metadata: null,
        expiresAt: "2026-06-01T00:00:00.000Z",
        lastAuthorizedAt: "2026-05-26T00:00:00.000Z",
        lastRefreshAt: null,
        lastErrorJson: {
          code: "CHANNEL_TOKEN_REFRESH_FAILED",
          message: "refresh token 已失效",
        },
        requiresAuth: true,
        createdAt: "2026-05-26T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    const publishes: SerializedPublish[] = [
      {
        id: "publish_youtube",
        jobId: "job_1",
        publishDraftId: "draft_youtube",
        channelAccountId: "acct_youtube",
        platform: "youtube_shorts",
        status: "published",
        requestId: "upload-session-1",
        remoteId: "youtube-video-1",
        remoteUrl: "https://www.youtube.com/watch?v=youtube-video-1",
        remoteStatus: { uploadStatus: "processed", privacyStatus: "private" },
        lastSyncedAt: "2026-06-26T02:00:00.000Z",
        attemptsJson: null,
        errorJson: null,
        createdAt: "2026-06-26T01:30:00.000Z",
        updatedAt: "2026-06-26T02:00:00.000Z",
      },
      {
        id: "publish_failed",
        jobId: "job_1",
        publishDraftId: "draft_youtube_failed",
        channelAccountId: "acct_youtube",
        platform: "youtube_shorts",
        status: "failed",
        requestId: "upload-session-2",
        remoteId: null,
        remoteUrl: null,
        remoteStatus: { uploadStatus: "failed" },
        lastSyncedAt: null,
        attemptsJson: null,
        errorJson: {
          code: "PUBLISH_REAL_PLATFORM_NOT_CONFIGURED",
          message: "缺少 YouTube OAuth 配置",
        },
        createdAt: "2026-06-26T01:40:00.000Z",
        updatedAt: "2026-06-26T01:41:00.000Z",
      },
    ];

    const html = renderToStaticMarkup(
      <PublishCenterPanel
        accounts={accounts}
        validationResults={[]}
        publishes={publishes}
        selectedPlatforms={["youtube_shorts"]}
        scheduleAt=""
        checking={false}
        publishing={false}
        exportingMp4={false}
        retryingPublishId={null}
        authorizingPlatform={null}
        onScheduleAtChange={vi.fn()}
        onRefreshAccounts={vi.fn()}
        onAuthorize={vi.fn()}
        onValidate={vi.fn()}
        onSaveDrafts={vi.fn()}
        onExportMp4={vi.fn()}
        onPublish={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(html).toContain("provider: youtube");
    expect(html).toContain("channel-123");
    expect(html).toContain("youtube.upload");
    expect(html).toContain("最近授权");
    expect(html).toContain("最近刷新");
    expect(html).toContain("Mock adapter");
    expect(html).toContain("refresh token 已失效");
    expect(html).toContain("重新授权");
    expect(html).toContain("https://www.youtube.com/watch?v=youtube-video-1");
    expect(html).toContain("processed");
    expect(html).toContain("private");
    expect(html).toContain("最近同步");
    expect(html).toContain("upload-session-1");
    expect(html).toContain("youtube-video-1");
    expect(html).toContain("PUBLISH_REAL_PLATFORM_NOT_CONFIGURED");
    expect(html).toContain("检查真实发布配置");
    expect(html).toContain("刷新远端状态");
  });

  it("maps publish statuses to user-facing labels", () => {
    expect(getPublishStatusLabel("published")).toBe("已发布");
    expect(getPublishStatusLabel("failed")).toBe("发布失败");
    expect(getPublishStatusLabel("unknown_status")).toBe("unknown_status");
  });
});
