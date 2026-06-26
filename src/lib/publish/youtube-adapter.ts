import { Readable } from "node:stream";
import type { PublishRealPlatformConfig } from "@/lib/publish/config";
import type {
  ChannelAdapterPublishInput,
  ChannelAdapterPublishWithVideoInput,
  ChannelAdapterResult,
  ChannelAdapterRetryInput,
  ChannelAdapterStatusResult,
  PublishChannelAdapter,
} from "@/lib/publish/channel-adapter";

export interface CreateYoutubeChannelAdapterInput {
  accessToken: string;
  config: PublishRealPlatformConfig;
  fetchImpl?: typeof fetch;
}

export function createYoutubeChannelAdapter(
  input: CreateYoutubeChannelAdapterInput
): PublishChannelAdapter {
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    platform: "youtube_shorts",
    provider: "youtube",
    isMock: false,
    async uploadVideo(publishInput) {
      if (!publishInput.validationJson?.passed || publishInput.platform !== "youtube_shorts") {
        return validationFailed();
      }

      if (!publishInput.finalVideo) {
        return {
          success: false,
          error: {
            code: "PUBLISH_FINAL_VIDEO_NOT_FOUND",
            message: "最终 MP4 产物不存在",
          },
        };
      }

      try {
        const uploadSessionUrl = await createYoutubeUploadSession({
          adapter: input,
          fetchImpl,
          publishInput,
        });
        const response = await fetchImpl(uploadSessionUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            "Content-Type": publishInput.finalVideo.contentType,
          },
          body: (await readableToBuffer(publishInput.finalVideo.stream)) as unknown as BodyInit,
        });

        if (!response.ok) {
          return uploadFailed(response.status);
        }

        const payload = await response.json();
        const remoteVideoId = typeof payload.id === "string" ? payload.id : null;
        if (!remoteVideoId) {
          return uploadFailed(response.status);
        }

        return {
          success: true,
          data: {
            provider: "youtube",
            platform: "youtube_shorts",
            requestId: remoteVideoId,
            remoteVideoId,
            remoteStatus: payload.status ?? null,
          },
        };
      } catch {
        return uploadFailed();
      }
    },
    async publish(publishInput) {
      return buildPublishedResult(publishInput, publishInput.remoteVideoId);
    },
    async getStatus(statusInput) {
      try {
        const remoteId = statusInput.remotePublishId ?? statusInput.requestId;
        const url = new URL(`${input.config.youtube.apiBaseUrl}/videos`);
        url.searchParams.set("part", "status,player");
        url.searchParams.set("id", remoteId);
        const response = await fetchImpl(url.toString(), {
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
          },
        });

        if (!response.ok) {
          return statusSyncFailed();
        }

        const payload = await response.json();
        const item = Array.isArray(payload.items) ? payload.items[0] : null;
        if (!item?.id) {
          return statusSyncFailed();
        }

        const remoteStatus = item.status ?? null;
        const status = mapYoutubeStatus(remoteStatus);
        const remoteUrl = `https://www.youtube.com/watch?v=${item.id}`;

        return {
          success: true,
          data: {
            provider: "youtube",
            platform: "youtube_shorts",
            requestId: statusInput.requestId,
            remotePublishId: item.id,
            status,
            remoteUrl,
            remoteStatus,
          },
        };
      } catch {
        return statusSyncFailed();
      }
    },
    async retry(retryInput) {
      const uploadResult = await this.uploadVideo(retryInput);
      if (!uploadResult.success) {
        return uploadResult;
      }

      const publishResult = buildPublishedResult(retryInput, uploadResult.data.remoteVideoId);
      if (!publishResult.success) {
        return publishResult;
      }

      return {
        success: true,
        data: {
          ...publishResult.data,
          requestId: `youtube-retry-${retryInput.publishDraftId}`,
          previousRequestId: retryInput.previousRequestId,
        },
      };
    },
  };
}

async function createYoutubeUploadSession(input: {
  adapter: CreateYoutubeChannelAdapterInput;
  fetchImpl: typeof fetch;
  publishInput: ChannelAdapterPublishInput;
}): Promise<string> {
  const url = new URL(`${input.adapter.config.youtube.uploadBaseUrl}/videos`);
  url.searchParams.set("uploadType", "resumable");
  url.searchParams.set("part", "snippet,status");
  url.searchParams.set(
    "notifySubscribers",
    String(input.adapter.config.youtube.notifySubscribers)
  );
  const metadata = {
    snippet: {
      title: input.publishInput.title,
      description: input.publishInput.description,
      tags: input.publishInput.tags,
      categoryId: input.adapter.config.youtube.defaultCategoryId,
    },
    status: {
      privacyStatus: input.adapter.config.youtube.defaultPrivacyStatus,
    },
  };
  const response = await input.fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.adapter.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.publishInput.finalVideo?.contentType ?? "video/mp4",
      ...(input.publishInput.finalVideo?.sizeBytes
        ? { "X-Upload-Content-Length": String(input.publishInput.finalVideo.sizeBytes) }
        : {}),
    },
    body: JSON.stringify(metadata),
  });
  const location = response.headers.get("Location");
  if (!response.ok || !location) {
    throw new Error("PUBLISH_UPLOAD_FAILED");
  }

  return location;
}

function buildPublishedResult(
  input: ChannelAdapterPublishWithVideoInput | ChannelAdapterRetryInput,
  remoteVideoId: string
): ChannelAdapterResult<{
  provider: "youtube";
  platform: "youtube_shorts";
  requestId: string;
  remotePublishId: string;
  status: "published";
  remoteUrl: string;
}> {
  return {
    success: true,
    data: {
      provider: "youtube",
      platform: "youtube_shorts",
      requestId: remoteVideoId,
      remotePublishId: remoteVideoId,
      status: "published",
      remoteUrl: `https://www.youtube.com/watch?v=${remoteVideoId}`,
    },
  };
}

function mapYoutubeStatus(status: unknown): "pending" | "uploading" | "published" | "failed" {
  if (!status || typeof status !== "object" || Array.isArray(status)) {
    return "pending";
  }

  const uploadStatus = (status as { uploadStatus?: unknown }).uploadStatus;
  if (uploadStatus === "processed") {
    return "published";
  }
  if (uploadStatus === "failed" || uploadStatus === "rejected") {
    return "failed";
  }
  if (uploadStatus === "uploaded") {
    return "uploading";
  }

  return "pending";
}

function validationFailed(): ChannelAdapterResult<never> {
  return {
    success: false,
    error: {
      code: "PUBLISH_VALIDATION_FAILED",
      message: "发布参数检查未通过",
    },
  };
}

function uploadFailed(status?: number): ChannelAdapterResult<never> {
  return {
    success: false,
    error: {
      code: status === 429 ? "PUBLISH_RATE_LIMITED" : "PUBLISH_UPLOAD_FAILED",
      message: status === 429 ? "平台限流" : "视频上传失败",
    },
  };
}

function statusSyncFailed(): ChannelAdapterResult<ChannelAdapterStatusResult> {
  return {
    success: false,
    error: {
      code: "PUBLISH_STATUS_SYNC_FAILED",
      message: "发布状态同步失败",
    },
  };
}

async function readableToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  if (Buffer.isBuffer(stream)) {
    return stream;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
