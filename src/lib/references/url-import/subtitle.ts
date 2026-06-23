export interface ReferenceSubtitleTrack {
  kind: "subtitles" | "automaticCaptions";
  language: string;
  ext: "vtt" | "srt";
  url: string;
}

export interface ParsedSubtitleSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface ParsedSubtitleText {
  text: string;
  segments: ParsedSubtitleSegment[];
}

interface SubtitleJson {
  subtitles?: unknown;
  automaticCaptions?: unknown;
}

const PREFERRED_LANGUAGES = [
  "zh",
  "zh-Hans",
  "zh-CN",
  "zh-Hant",
  "zh-TW",
  "en",
];

export function selectPreferredSubtitleTrack(value: unknown): ReferenceSubtitleTrack | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const subtitleJson = value as SubtitleJson;
  return (
    selectTrackFromMap(subtitleJson.subtitles, "subtitles") ??
    selectTrackFromMap(subtitleJson.automaticCaptions, "automaticCaptions")
  );
}

export function parseSubtitleText(content: string, ext: "vtt" | "srt"): ParsedSubtitleText {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments = blocks.flatMap((block) => parseSubtitleBlock(block, ext));
  if (segments.length === 0) {
    throw new Error("No subtitle cues found");
  }

  return {
    text: segments.map((segment) => segment.text).join("\n"),
    segments,
  };
}

function selectTrackFromMap(
  value: unknown,
  kind: ReferenceSubtitleTrack["kind"]
): ReferenceSubtitleTrack | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const tracks = Object.entries(value as Record<string, unknown>).flatMap(([language, items]) => {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.flatMap((item) => normalizeTrack(item, language, kind) ?? []);
  });

  if (tracks.length === 0) {
    return null;
  }

  return tracks.sort(compareSubtitleTracks)[0];
}

function normalizeTrack(
  item: unknown,
  language: string,
  kind: ReferenceSubtitleTrack["kind"]
): ReferenceSubtitleTrack | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const track = item as { ext?: unknown; url?: unknown };
  const ext = typeof track.ext === "string" ? track.ext.toLowerCase() : "";
  if ((ext !== "vtt" && ext !== "srt") || typeof track.url !== "string" || !track.url.trim()) {
    return null;
  }

  return {
    kind,
    language,
    ext,
    url: track.url,
  };
}

function compareSubtitleTracks(left: ReferenceSubtitleTrack, right: ReferenceSubtitleTrack): number {
  return getLanguageRank(left.language) - getLanguageRank(right.language);
}

function getLanguageRank(language: string): number {
  const index = PREFERRED_LANGUAGES.indexOf(language);
  return index === -1 ? PREFERRED_LANGUAGES.length : index;
}

function parseSubtitleBlock(block: string, ext: "vtt" | "srt"): ParsedSubtitleSegment[] {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const timingIndex = lines.findIndex((line) => line.includes("-->"));
  if (timingIndex === -1) {
    return [];
  }

  const timing = parseTimingLine(lines[timingIndex]);
  if (!timing) {
    return [];
  }

  const text = lines
    .slice(timingIndex + 1)
    .filter((line) => !(ext === "vtt" && line.startsWith("NOTE")))
    .map(cleanSubtitleText)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!text) {
    return [];
  }

  return [
    {
      ...timing,
      text,
    },
  ];
}

function parseTimingLine(line: string): { startMs: number; endMs: number } | null {
  const [start, endWithSettings] = line.split("-->").map((part) => part.trim());
  if (!start || !endWithSettings) {
    return null;
  }

  const end = endWithSettings.split(/\s+/)[0];
  const startMs = parseTimestamp(start);
  const endMs = parseTimestamp(end);
  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }

  return { startMs, endMs };
}

function parseTimestamp(value: string): number | null {
  const normalized = value.replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const [hoursText, minutesText, secondsText] =
    parts.length === 3 ? parts : ["0", parts[0], parts[1]];
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

function cleanSubtitleText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\{\\[^}]+}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
