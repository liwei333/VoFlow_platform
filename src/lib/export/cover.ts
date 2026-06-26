import {
  EXPORT_COVER_FRAME_DEFAULTS,
  EXPORT_COVER_TITLE_DEFAULTS,
} from "@/lib/export/constants";

export interface BuildCoverFrameFfmpegArgsInput {
  videoPath: string;
  outputPath: string;
  durationSeconds?: number | null;
}

export interface BuildCoverTitleFfmpegArgsInput {
  baseImagePath: string;
  outputPath: string;
  titleText: string;
}

export interface ResolveCoverTitleTextInput {
  titleCandidates?: unknown;
  scriptContent: string;
}

export function buildCoverFrameFfmpegArgs(
  input: BuildCoverFrameFfmpegArgsInput
): string[] {
  const frameTimeSeconds = resolveCoverFrameTimeSeconds(input.durationSeconds);

  return [
    "-y",
    "-ss",
    frameTimeSeconds.toFixed(3),
    "-i",
    input.videoPath,
    "-frames:v",
    "1",
    "-q:v",
    String(EXPORT_COVER_FRAME_DEFAULTS.jpegQuality),
    input.outputPath,
  ];
}

export function resolveCoverFrameTimeSeconds(
  durationSeconds?: number | null
): number {
  if (!durationSeconds || durationSeconds <= 0) {
    return EXPORT_COVER_FRAME_DEFAULTS.fallbackFrameTimeSeconds;
  }
  return Math.max(
    EXPORT_COVER_FRAME_DEFAULTS.fallbackFrameTimeSeconds,
    durationSeconds / 2
  );
}

export function resolveCoverTitleText(
  input: ResolveCoverTitleTextInput
): string {
  const candidate = Array.isArray(input.titleCandidates)
    ? input.titleCandidates.find(
        (title): title is string =>
          typeof title === "string" && title.trim().length > 0
      )
    : null;
  const title = candidate?.trim() || input.scriptContent.trim();
  return title.slice(0, EXPORT_COVER_TITLE_DEFAULTS.maxTitleLength);
}

export function buildCoverTitleFfmpegArgs(
  input: BuildCoverTitleFfmpegArgsInput
): string[] {
  const style = EXPORT_COVER_TITLE_DEFAULTS;
  const filter = [
    `drawbox=x=0:y=${style.overlayY}:w=iw:h=${style.overlayHeight}:color=${style.overlayColor}:t=fill`,
    `drawtext=text='${escapeDrawText(input.titleText)}':fontcolor=${style.fontColor}:fontsize=${style.fontSize}:line_spacing=${style.lineSpacing}:x=(w-text_w)/2:y=${style.textY}`,
  ].join(",");

  return [
    "-y",
    "-i",
    input.baseImagePath,
    "-vf",
    filter,
    "-frames:v",
    "1",
    input.outputPath,
  ];
}

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\r?\n/g, " ");
}
