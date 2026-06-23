import type { ReferenceLinkParsedData } from "@/lib/references/parser";

type SubtitleTrack = {
  ext?: string;
  url?: string;
  name?: string;
};

type SubtitleMap = Record<string, SubtitleTrack[]>;

export interface NormalizedYtDlpMetadata {
  title?: string;
  durationMs?: number;
  thumbnailUrl?: string;
  extractor?: string;
  webpageUrl?: string;
  subtitles: SubtitleMap;
  automaticCaptions: SubtitleMap;
  rawSummary: unknown;
}

export function normalizeYtDlpMetadata(
  metadata: Record<string, unknown>,
  options: {
    normalizedUrl: string;
    maxMetadataBytes: number;
  }
): NormalizedYtDlpMetadata {
  return {
    title: readString(metadata.title),
    durationMs: readDurationMs(metadata.duration),
    thumbnailUrl: readString(metadata.thumbnail),
    extractor: readString(metadata.extractor_key) ?? readString(metadata.extractor),
    webpageUrl: readString(metadata.webpage_url) ?? options.normalizedUrl,
    subtitles: normalizeSubtitleMap(metadata.subtitles),
    automaticCaptions: normalizeSubtitleMap(metadata.automatic_captions),
    rawSummary: buildBoundedRawSummary(metadata, options.maxMetadataBytes),
  };
}

export function ytDlpMetadataToParsedData(
  metadata: NormalizedYtDlpMetadata
): ReferenceLinkParsedData {
  return {
    title: metadata.title,
    durationMs: metadata.durationMs,
    thumbnailUrl: metadata.thumbnailUrl,
    raw: {
      metadata: {
        extractor: metadata.extractor,
        webpageUrl: metadata.webpageUrl,
        subtitles: metadata.subtitles,
        automaticCaptions: metadata.automaticCaptions,
        rawSummary: metadata.rawSummary,
      },
    },
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDurationMs(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value * 1000);
}

function normalizeSubtitleMap(value: unknown): SubtitleMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([language, tracks]) => [
        language,
        Array.isArray(tracks) ? tracks.map(normalizeSubtitleTrack).filter(Boolean) : [],
      ])
      .filter(([, tracks]) => tracks.length > 0)
  ) as SubtitleMap;
}

function normalizeSubtitleTrack(value: unknown): SubtitleTrack | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const track = value as Record<string, unknown>;
  const normalized = {
    ext: readString(track.ext),
    url: readString(track.url),
    name: readString(track.name),
  };

  return normalized.ext || normalized.url || normalized.name ? normalized : null;
}

function buildBoundedRawSummary(
  metadata: Record<string, unknown>,
  maxMetadataBytes: number
): unknown {
  const summary = {
    id: metadata.id,
    display_id: metadata.display_id,
    extractor: metadata.extractor,
    extractor_key: metadata.extractor_key,
    webpage_url: metadata.webpage_url,
    uploader: metadata.uploader,
    channel: metadata.channel,
    availability: metadata.availability,
  };
  const serialized = JSON.stringify(summary);

  if (serialized.length <= maxMetadataBytes) {
    return summary;
  }

  return {
    truncated: true,
    byteLength: serialized.length,
  };
}
