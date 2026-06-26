import { describe, expect, it } from "vitest";
import {
  PUBLISH_ADAPTER_ERROR_CODES,
  createMockChannelAdapter,
  getChannelAdapter,
  isSuccessfulAdapterResult,
  type ChannelAdapterPublishInput,
} from "@/lib/publish/channel-adapter";

describe("publish channel adapter", () => {
  const publishInput: ChannelAdapterPublishInput = {
    platform: "douyin",
    publishDraftId: "draft-1",
    channelAccountId: "channel-account-1",
    finalVideoArtifactId: "final-video-1",
    title: "合规发布标题",
    description: "合规发布描述",
    tags: ["新品", "口播"],
    topics: ["618"],
    coverArtifactId: "cover-1",
    validationJson: {
      passed: true,
      platform: "douyin",
      checks: [],
    },
  };

  it("returns a mock adapter for publish platforms", () => {
    const adapter = getChannelAdapter("douyin");

    expect(adapter.provider).toBe("mock");
    expect(adapter.platform).toBe("douyin");
    expect(adapter.isMock).toBe(true);
  });

  it("uploads a video through the mock adapter", async () => {
    const adapter = createMockChannelAdapter("douyin");
    const result = await adapter.uploadVideo(publishInput);

    expect(result).toMatchObject({
      success: true,
      data: {
        provider: "mock",
        platform: "douyin",
        requestId: "mock-upload-douyin-draft-1",
        remoteVideoId: "mock-video-douyin-final-video-1",
      },
    });
    expect(isSuccessfulAdapterResult(result)).toBe(true);
  });

  it("publishes, reads status, and retries through the mock adapter", async () => {
    const adapter = createMockChannelAdapter("douyin");
    const publishResult = await adapter.publish({
      ...publishInput,
      remoteVideoId: "mock-video-douyin-final-video-1",
    });

    expect(publishResult).toMatchObject({
      success: true,
      data: {
        provider: "mock",
        platform: "douyin",
        requestId: "mock-publish-douyin-draft-1",
        remotePublishId: "mock-publish-douyin-draft-1",
        status: "published",
      },
    });

    const statusResult = await adapter.getStatus({
      platform: "douyin",
      requestId: "mock-publish-douyin-draft-1",
      remotePublishId: "mock-publish-douyin-draft-1",
    });

    expect(statusResult).toMatchObject({
      success: true,
      data: {
        provider: "mock",
        platform: "douyin",
        requestId: "mock-publish-douyin-draft-1",
        remotePublishId: "mock-publish-douyin-draft-1",
        status: "published",
      },
    });

    const retryResult = await adapter.retry({
      ...publishInput,
      previousRequestId: "failed-request-1",
      remoteVideoId: "mock-video-douyin-final-video-1",
    });

    expect(retryResult).toMatchObject({
      success: true,
      data: {
        provider: "mock",
        platform: "douyin",
        requestId: "mock-retry-douyin-draft-1",
        remotePublishId: "mock-publish-douyin-draft-1",
        status: "published",
        previousRequestId: "failed-request-1",
      },
    });
  });

  it("rejects publish calls when validationJson has not passed", async () => {
    const adapter = createMockChannelAdapter("douyin");
    const result = await adapter.publish({
      ...publishInput,
      remoteVideoId: "mock-video-douyin-final-video-1",
      validationJson: {
        passed: false,
        platform: "douyin",
        checks: [],
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: PUBLISH_ADAPTER_ERROR_CODES.validationFailed,
        message: "发布参数检查未通过",
      },
    });
  });
});
