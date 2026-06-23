import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_LINK_IMPORT_ENV_EXAMPLES,
  buildReferenceLinkImportConfig,
} from "@/lib/references/url-import/config";

describe("reference URL import configuration", () => {
  it("defaults real reference link import to disabled and full video download to disabled", () => {
    expect(buildReferenceLinkImportConfig({})).toMatchObject({
      enabled: false,
      ytdlpBin: "yt-dlp",
      timeoutMs: 60_000,
      maxDurationMs: 180_000,
      maxAudioBytes: 50 * 1024 * 1024,
      maxMetadataBytes: 2 * 1024 * 1024,
      maxSubtitleBytes: 5 * 1024 * 1024,
      allowAudioExtract: true,
      allowFullVideoDownload: false,
      allowedPlatforms: ["youtube", "bilibili"],
    });
  });

  it("parses enabled flags, byte limits, and platform allowlist from env", () => {
    expect(
      buildReferenceLinkImportConfig({
        VOFLOW_REFERENCE_LINK_IMPORT_ENABLED: "true",
        VOFLOW_YTDLP_BIN: "/opt/bin/yt-dlp",
        VOFLOW_YTDLP_TIMEOUT_MS: "120000",
        VOFLOW_REFERENCE_MAX_DURATION_MS: "90000",
        VOFLOW_REFERENCE_MAX_AUDIO_MB: "25",
        VOFLOW_REFERENCE_MAX_METADATA_BYTES: "1024",
        VOFLOW_REFERENCE_MAX_SUBTITLE_BYTES: "2048",
        VOFLOW_REFERENCE_ALLOW_AUDIO_EXTRACT: "false",
        VOFLOW_REFERENCE_ALLOW_FULL_VIDEO_DOWNLOAD: "false",
        VOFLOW_REFERENCE_ALLOWED_PLATFORMS: "youtube,bilibili,unknown,douyin",
      })
    ).toMatchObject({
      enabled: true,
      ytdlpBin: "/opt/bin/yt-dlp",
      timeoutMs: 120_000,
      maxDurationMs: 90_000,
      maxAudioBytes: 25 * 1024 * 1024,
      maxMetadataBytes: 1024,
      maxSubtitleBytes: 2048,
      allowAudioExtract: false,
      allowFullVideoDownload: false,
      allowedPlatforms: ["youtube", "bilibili", "douyin"],
    });
  });

  it("keeps reference URL import env examples aligned with .env.example", () => {
    const envExample = readFileSync(".env.example", "utf8");
    const envValues = Object.fromEntries(
      envExample
        .split("\n")
        .map((line) => line.match(/^([A-Z0-9_]+)="?([^"\n]+)"?$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => [match[1], match[2]])
    );

    expect(REFERENCE_LINK_IMPORT_ENV_EXAMPLES).toEqual(
      REFERENCE_LINK_IMPORT_ENV_EXAMPLES.map((example) => ({
        ...example,
        value: envValues[example.key],
      }))
    );
  });
});
