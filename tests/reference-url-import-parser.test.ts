import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { ReferenceLinkParserInput } from "@/lib/references/parser";
import { normalizeYtDlpMetadata, ytDlpMetadataToParsedData } from "@/lib/references/url-import/metadata";
import { YtDlpClient } from "@/lib/references/url-import/ytdlp-client";

describe("reference URL import parser", () => {
  it("normalizes yt-dlp metadata into bounded reference metadata", () => {
    const metadata = normalizeYtDlpMetadata(
      {
        title: "公开参考视频",
        duration: 123.4,
        thumbnail: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
        extractor_key: "Youtube",
        webpage_url: "https://www.youtube.com/watch?v=demo",
        subtitles: {
          zh: [{ ext: "vtt", url: "https://caption.example.com/zh.vtt" }],
        },
        automatic_captions: {
          en: [{ ext: "vtt", url: "https://caption.example.com/en.vtt" }],
        },
        formats: Array.from({ length: 20 }, (_, index) => ({ format_id: String(index) })),
      },
      {
        normalizedUrl: "https://www.youtube.com/watch?v=demo",
        maxMetadataBytes: 512,
      }
    );

    expect(metadata).toMatchObject({
      title: "公开参考视频",
      durationMs: 123_400,
      thumbnailUrl: "https://i.ytimg.com/vi/demo/hqdefault.jpg",
      extractor: "Youtube",
      webpageUrl: "https://www.youtube.com/watch?v=demo",
      subtitles: {
        zh: [{ ext: "vtt", url: "https://caption.example.com/zh.vtt" }],
      },
      automaticCaptions: {
        en: [{ ext: "vtt", url: "https://caption.example.com/en.vtt" }],
      },
    });
    expect(JSON.stringify(metadata.rawSummary).length).toBeLessThanOrEqual(512);
  });

  it("maps normalized metadata into ReferenceLinkParsedData without storing metadata in structureJson", () => {
    const parsed = ytDlpMetadataToParsedData({
      title: "公开参考视频",
      durationMs: 30_000,
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      extractor: "Youtube",
      webpageUrl: "https://www.youtube.com/watch?v=demo",
      subtitles: {},
      automaticCaptions: {},
      rawSummary: { id: "demo" },
    });

    expect(parsed).toEqual({
      title: "公开参考视频",
      durationMs: 30_000,
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
      raw: {
        metadata: {
          extractor: "Youtube",
          webpageUrl: "https://www.youtube.com/watch?v=demo",
          subtitles: {},
          automaticCaptions: {},
          rawSummary: { id: "demo" },
        },
      },
    });
  });

  it("calls yt-dlp through spawn args without shell command strings", async () => {
    const spawn = vi.fn(() => createProcess(JSON.stringify({ title: "Demo", duration: 2 })));
    const client = new YtDlpClient({
      ytdlpBin: "/opt/bin/yt-dlp",
      timeoutMs: 5_000,
      maxMetadataBytes: 4096,
      spawn,
    });

    await expect(client.getMetadata("https://www.youtube.com/watch?v=demo")).resolves.toMatchObject({
      title: "Demo",
      duration: 2,
    });
    expect(spawn).toHaveBeenCalledWith(
      "/opt/bin/yt-dlp",
      expect.arrayContaining(["--dump-single-json", "https://www.youtube.com/watch?v=demo"]),
      expect.objectContaining({ shell: false })
    );
  });

  it("rejects yt-dlp metadata output that exceeds the configured size limit", async () => {
    const spawn = vi.fn(() => createProcess("x".repeat(32)));
    const client = new YtDlpClient({
      ytdlpBin: "yt-dlp",
      timeoutMs: 5_000,
      maxMetadataBytes: 8,
      spawn,
    });

    await expect(client.getMetadata("https://www.youtube.com/watch?v=demo")).rejects.toMatchObject({
      code: "REFERENCE_METADATA_INVALID",
      detail: "yt-dlp metadata exceeded configured size limit",
    });
  });

  it("extracts audio through bounded yt-dlp args without shell command strings", async () => {
    const spawn = vi.fn(() => createProcess(""));
    const client = new YtDlpClient({
      ytdlpBin: "/opt/bin/yt-dlp",
      timeoutMs: 5_000,
      maxMetadataBytes: 4096,
      spawn,
    });

    await expect(
      client.extractAudio("https://www.youtube.com/watch?v=demo", {
        maxAudioBytes: 1024,
      })
    ).rejects.toMatchObject({
      code: "REFERENCE_AUDIO_EXTRACT_FAILED",
    });
    expect(spawn).toHaveBeenCalledWith(
      "/opt/bin/yt-dlp",
      expect.arrayContaining([
        "--no-playlist",
        "--extract-audio",
        "--audio-format",
        "m4a",
        "--max-filesize",
        "1024",
        "https://www.youtube.com/watch?v=demo",
      ]),
      expect.objectContaining({ shell: false })
    );
  });

  it("uses a parser input to call the client and normalize metadata", async () => {
    const input: ReferenceLinkParserInput = {
      sourceUrl: "https://www.youtube.com/watch?v=demo",
      platform: "youtube",
      adapterKey: "youtube",
      normalizedUrl: "https://www.youtube.com/watch?v=demo",
      normalizedHost: "www.youtube.com",
    };
    const client = {
      getMetadata: vi.fn().mockResolvedValue({
        title: "Demo",
        duration: 4,
        thumbnail: "https://cdn.example.com/thumb.jpg",
      }),
    };

    const { createYtDlpReferenceLinkParser } = await import("@/lib/references/url-import/parser");
    const parser = createYtDlpReferenceLinkParser({
      client,
      maxMetadataBytes: 4096,
    });

    await expect(parser.parse(input)).resolves.toMatchObject({
      title: "Demo",
      durationMs: 4_000,
      thumbnailUrl: "https://cdn.example.com/thumb.jpg",
    });
    expect(client.getMetadata).toHaveBeenCalledWith("https://www.youtube.com/watch?v=demo");
  });
});

function createProcess(stdoutPayload: string) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: () => boolean;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = vi.fn(() => true);

  queueMicrotask(() => {
    child.stdout.end(stdoutPayload);
    child.stderr.end("");
    child.emit("close", 0);
  });

  return child;
}
