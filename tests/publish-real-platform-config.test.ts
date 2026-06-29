import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getChannelAdapter } from "@/lib/publish/channel-adapter";
import {
  PUBLISH_REAL_PLATFORM_ERROR_CODES,
  PUBLISH_REAL_PLATFORM_ENV_EXAMPLES,
  PublishRealPlatformConfigError,
  buildPublishRealPlatformConfig,
} from "@/lib/publish/config";

const envExamplePath = join(process.cwd(), ".env.example");

describe("publish real platform config", () => {
  it("documents every real publish env key in .env.example", () => {
    const envExample = readFileSync(envExamplePath, "utf8");

    for (const example of PUBLISH_REAL_PLATFORM_ENV_EXAMPLES) {
      expect(envExample).toContain(`${example.key}=`);
    }
  });

  it("keeps local mock adapter mode by default without requiring YouTube secrets", () => {
    const config = buildPublishRealPlatformConfig({});

    expect(config.realAdapterEnabled).toBe(false);
    expect(config.allowMockAdapter).toBe(true);
    expect(config.validation).toEqual({ passed: true, missingEnvKeys: [] });
  });

  it("reports missing required keys when real publish is enabled", () => {
    const config = buildPublishRealPlatformConfig({
      PUBLISH_REAL_ADAPTER_ENABLED: "true",
      PUBLISH_REAL_PROVIDER: "youtube",
      PUBLISH_ALLOW_MOCK_ADAPTER: "false",
    });

    expect(config.validation.passed).toBe(false);
    expect(config.validation.error?.code).toBe(
      PUBLISH_REAL_PLATFORM_ERROR_CODES.notConfigured
    );
    expect(config.validation.missingEnvKeys).toEqual([
      "CHANNEL_TOKEN_ENCRYPTION_SECRET",
      "YOUTUBE_CLIENT_ID",
      "YOUTUBE_CLIENT_SECRET",
      "YOUTUBE_REDIRECT_URI",
    ]);
  });

  it("builds a YouTube config when required keys are present", () => {
    const config = buildPublishRealPlatformConfig({
      PUBLISH_REAL_ADAPTER_ENABLED: "true",
      PUBLISH_REAL_PROVIDER: "youtube",
      PUBLISH_ALLOW_MOCK_ADAPTER: "false",
      CHANNEL_TOKEN_ENCRYPTION_SECRET: "secret",
      YOUTUBE_CLIENT_ID: "client-id",
      YOUTUBE_CLIENT_SECRET: "client-secret",
      YOUTUBE_REDIRECT_URI: "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
    });

    expect(config.validation).toEqual({ passed: true, missingEnvKeys: [] });
    expect(config.youtube).toMatchObject({
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
      apiBaseUrl: "https://www.googleapis.com/youtube/v3",
      uploadBaseUrl: "https://www.googleapis.com/upload/youtube/v3",
      oauthAuthorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      oauthTokenUrl: "https://oauth2.googleapis.com/token",
      defaultPrivacyStatus: "private",
      defaultCategoryId: "22",
      notifySubscribers: false,
    });
    expect(config.youtube.scopes).toEqual([
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ]);
  });

  it("fails fast instead of silently returning a mock adapter when real publish is enabled", () => {
    expect(() =>
      getChannelAdapter("youtube_shorts", {
        PUBLISH_REAL_ADAPTER_ENABLED: "true",
        PUBLISH_REAL_PROVIDER: "youtube",
        PUBLISH_ALLOW_MOCK_ADAPTER: "false",
      })
    ).toThrow(PublishRealPlatformConfigError);
  });

  it("fails fast on missing real publish config before considering mock fallback", () => {
    expect(() => {
      getChannelAdapter("youtube_shorts", {
        PUBLISH_REAL_ADAPTER_ENABLED: "true",
        PUBLISH_REAL_PROVIDER: "youtube",
        PUBLISH_ALLOW_MOCK_ADAPTER: "true",
      });
    }).toThrow(PublishRealPlatformConfigError);

    try {
      getChannelAdapter("youtube_shorts", {
        PUBLISH_REAL_ADAPTER_ENABLED: "true",
        PUBLISH_REAL_PROVIDER: "youtube",
        PUBLISH_ALLOW_MOCK_ADAPTER: "true",
      });
    } catch (error) {
      expect((error as PublishRealPlatformConfigError).code).toBe(
        PUBLISH_REAL_PLATFORM_ERROR_CODES.notConfigured
      );
    }
  });

  it("fails fast for non-YouTube platforms when real publish forbids mock fallback", () => {
    expect(() =>
      getChannelAdapter("douyin", {
        PUBLISH_REAL_ADAPTER_ENABLED: "true",
        PUBLISH_REAL_PROVIDER: "youtube",
        PUBLISH_ALLOW_MOCK_ADAPTER: "false",
        CHANNEL_TOKEN_ENCRYPTION_SECRET: "secret",
        YOUTUBE_CLIENT_ID: "client-id",
        YOUTUBE_CLIENT_SECRET: "client-secret",
        YOUTUBE_REDIRECT_URI:
          "http://localhost:3000/api/channel-accounts/youtube_shorts/oauth/callback",
      })
    ).toThrow(PublishRealPlatformConfigError);
  });
});
