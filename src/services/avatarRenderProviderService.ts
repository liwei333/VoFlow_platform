import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  AVATAR_RENDER_LOCAL_PROVIDER,
  AVATAR_RENDER_LOCAL_RENDER_PATH,
  AVATAR_RENDER_LOCAL_TIMEOUT_MS,
  AVATAR_RENDER_MOCK_DURATION_MS,
  AVATAR_RENDER_MOCK_MODEL,
  AVATAR_RENDER_MOCK_PROVIDER,
  AVATAR_RENDER_VIDEO_CONTENT_TYPE,
  AVATAR_RENDER_VIDEO_EXTENSION,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";
import type {
  AvatarRenderPayload,
  AvatarRenderResult,
  LocalAvatarRenderServiceConfig,
} from "@/lib/avatar-render/types";

export interface AvatarRenderProvider {
  renderAvatarVideo(payload: AvatarRenderPayload): Promise<AvatarRenderResult>;
}

export type AvatarRenderProviderTransport = typeof fetch;

export type MockAvatarRenderProviderOptions = {
  outputDir?: string;
};

export class AvatarRenderProviderError extends Error {
  constructor(
    public readonly code: AvatarRenderErrorCode,
    message = AVATAR_RENDER_ERROR_MESSAGES[code]
  ) {
    super(`${code}: ${message}`);
    this.name = "AvatarRenderProviderError";
  }
}

export function createMockAvatarRenderProvider(
  options: MockAvatarRenderProviderOptions = {}
): AvatarRenderProvider {
  return {
    async renderAvatarVideo(payload) {
      const outputDir = options.outputDir ?? path.join(tmpdir(), "voflow-avatar-render");
      await mkdir(outputDir, { recursive: true });

      const videoPath = path.join(
        outputDir,
        `${sanitizeFileName(payload.requestId)}-${payload.mode}.${AVATAR_RENDER_VIDEO_EXTENSION}`
      );
      await writeFile(videoPath, MOCK_MP4_BUFFER);

      return {
        provider: AVATAR_RENDER_MOCK_PROVIDER,
        videoPath,
        durationMs: AVATAR_RENDER_MOCK_DURATION_MS,
        resolution: payload.renderOptions.resolution,
        model: AVATAR_RENDER_MOCK_MODEL,
        providerRequestId: `mock-${payload.traceId}`,
        metadata: {
          mocked: true,
          mode: payload.mode,
          crop: payload.renderOptions.crop,
          aspectRatio: payload.aspectRatio,
          contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
          fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
        },
      };
    },
  };
}

export function createAvatarRenderProvider(
  provider: string,
  localService?: LocalAvatarRenderServiceConfig | null
): AvatarRenderProvider {
  if (provider === AVATAR_RENDER_MOCK_PROVIDER) {
    return createMockAvatarRenderProvider();
  }

  return createLocalAvatarRenderProvider(localService);
}

export function createLocalAvatarRenderProvider(
  service?: LocalAvatarRenderServiceConfig | null,
  transport: AvatarRenderProviderTransport = fetch
): AvatarRenderProvider {
  return {
    async renderAvatarVideo(payload) {
      if (!service?.baseUrl || service.status !== "online") {
        throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.providerUnavailable);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AVATAR_RENDER_LOCAL_TIMEOUT_MS);

      try {
        const response = await transport(
          `${service.baseUrl.replace(/\/$/, "")}${AVATAR_RENDER_LOCAL_RENDER_PATH}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...toLocalAvatarRenderPayload(payload),
              modelName: service.modelName,
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.providerUnavailable);
        }

        return normalizeLocalAvatarRenderResult(await response.json(), payload);
      } catch (error) {
        if (error instanceof AvatarRenderProviderError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.providerTimeout);
        }

        throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.providerUnavailable);
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function normalizeLocalAvatarRenderResult(
  value: unknown,
  payload: AvatarRenderPayload
): AvatarRenderResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
  }

  const data = value as {
    video_path?: unknown;
    duration_ms?: unknown;
    resolution?: unknown;
    model?: unknown;
    provider_request_id?: unknown;
    metadata?: unknown;
  };

  if (typeof data.video_path !== "string" || data.video_path.length === 0) {
    throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
  }

  if (typeof data.duration_ms !== "number" || !Number.isFinite(data.duration_ms) || data.duration_ms <= 0) {
    throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
  }

  if (typeof data.resolution !== "string" || data.resolution.length === 0) {
    throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
  }

  if (typeof data.model !== "string" || data.model.length === 0) {
    throw avatarRenderProviderError(AVATAR_RENDER_ERROR_CODES.invalidProviderOutput);
  }

  return {
    provider: AVATAR_RENDER_LOCAL_PROVIDER,
    videoPath: data.video_path,
    durationMs: Math.round(data.duration_ms),
    resolution: data.resolution,
    model: data.model,
    ...(typeof data.provider_request_id === "string"
      ? { providerRequestId: data.provider_request_id }
      : {}),
    metadata: {
      ...normalizeMetadata(data.metadata),
      mode: payload.mode,
      crop: payload.renderOptions.crop,
      aspectRatio: payload.aspectRatio,
      contentType: AVATAR_RENDER_VIDEO_CONTENT_TYPE,
      fileExtension: AVATAR_RENDER_VIDEO_EXTENSION,
    },
  };
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toLocalAvatarRenderPayload(payload: AvatarRenderPayload) {
  return {
    requestId: payload.requestId,
    jobId: payload.jobId,
    nodeId: payload.nodeId,
    avatarId: payload.avatarId,
    sourceImageUrl: payload.sourceImageUrl,
    audioUrl: payload.audioUrl,
    mode: payload.mode,
    aspectRatio: payload.aspectRatio,
    renderOptions: payload.renderOptions,
    traceId: payload.traceId,
  };
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function avatarRenderProviderError(code: AvatarRenderErrorCode) {
  return new AvatarRenderProviderError(code);
}

const MOCK_MP4_BASE64 =
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMXbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAMgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAkF0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAMgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAADIAAAAAAABAAAAAAG5bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAACABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABZG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASRzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDAgbGli";

const MOCK_MP4_BASE64_CONTINUED =
  "eDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAK/+EAGWdkAAqs2UKN+TARAAADAAEAAAMACg8SJZYBAAZo6+PLIsD9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAc3gAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAgAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAuMAAAABAAAAFHN0Y28AAAAAAAAAAQAAA0cAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjYyLjEyLjEwMAAAAAhmcmVlAAAC621kYXQAAAKtBgX//6ncRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIyIGIzNTYwNWEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5ZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0zIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACA";

const MOCK_MP4_BASE64_END =
  "AAAALmWIhAA///73aJ8Cm15hqoDklcUl20+B/6tnkofbJJKUrKowl3Qy8C1gARoGbw==";

const MOCK_MP4_BUFFER = Buffer.from(
  `${MOCK_MP4_BASE64}${MOCK_MP4_BASE64_CONTINUED}${MOCK_MP4_BASE64_END}`,
  "base64"
);
