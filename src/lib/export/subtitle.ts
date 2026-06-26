import {
  EXPORT_ASS_SCRIPT_RESOLUTION,
  EXPORT_ASS_SUBTITLE_STYLE,
  EXPORT_SUBTITLE_TIMING,
} from "@/lib/export/constants";

export interface SplitSubtitleTextOptions {
  maxCharsPerCue?: number;
}

export interface BuildSrtSubtitleOptions extends SplitSubtitleTextOptions {
  charsPerSecond?: number;
  minCueDurationMs?: number;
  maxCueDurationMs?: number;
}

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

const SENTENCE_END_PATTERN = /[。！？!?；;]/;
const SOFT_BREAK_PATTERN = /[，,、：:]/;

export function splitSubtitleText(
  content: string,
  options: SplitSubtitleTextOptions = {}
): string[] {
  const maxCharsPerCue =
    options.maxCharsPerCue ?? EXPORT_SUBTITLE_TIMING.maxCharsPerCue;
  const normalized = content.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const cues: string[] = [];
  let buffer = "";

  for (const char of normalized) {
    buffer += char;

    if (SENTENCE_END_PATTERN.test(char)) {
      pushChunks(cues, buffer, maxCharsPerCue);
      buffer = "";
      continue;
    }

    if (buffer.length >= maxCharsPerCue) {
      const softBreakIndex = findLastSoftBreak(buffer);
      if (softBreakIndex >= Math.floor(maxCharsPerCue * 0.45)) {
        cues.push(buffer.slice(0, softBreakIndex + 1).trim());
        buffer = buffer.slice(softBreakIndex + 1).trimStart();
      } else {
        cues.push(buffer.slice(0, maxCharsPerCue).trim());
        buffer = buffer.slice(maxCharsPerCue).trimStart();
      }
    }
  }

  if (buffer.trim()) {
    pushChunks(cues, buffer, maxCharsPerCue);
  }

  return cues.filter(Boolean);
}

export function buildSubtitleCues(
  content: string,
  options: BuildSrtSubtitleOptions = {}
): SubtitleCue[] {
  const charsPerSecond =
    options.charsPerSecond ?? EXPORT_SUBTITLE_TIMING.charsPerSecond;
  const minCueDurationMs =
    options.minCueDurationMs ?? EXPORT_SUBTITLE_TIMING.minCueDurationMs;
  const maxCueDurationMs =
    options.maxCueDurationMs ?? EXPORT_SUBTITLE_TIMING.maxCueDurationMs;

  let cursorMs = 0;

  return splitSubtitleText(content, options).map((text, cueIndex) => {
    const durationMs = clamp(
      Math.ceil((text.length / charsPerSecond) * 1000),
      minCueDurationMs,
      maxCueDurationMs
    );
    const cue = {
      index: cueIndex + 1,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
      text,
    };
    cursorMs += durationMs;
    return cue;
  });
}

export function buildSrtSubtitle(
  content: string,
  options: BuildSrtSubtitleOptions = {}
): string {
  return buildSubtitleCues(content, options)
    .flatMap((cue) => [
      String(cue.index),
      `${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}`,
      cue.text,
      "",
    ])
    .join("\n");
}

export function buildAssSubtitle(
  content: string,
  options: BuildSrtSubtitleOptions = {}
): string {
  const cues = buildSubtitleCues(content, options);
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${EXPORT_ASS_SCRIPT_RESOLUTION.width}`,
    `PlayResY: ${EXPORT_ASS_SCRIPT_RESOLUTION.height}`,
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    buildAssStyleLine(),
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...cues.map(
      (cue) =>
        `Dialogue: 0,${formatAssTimestamp(cue.startMs)},${formatAssTimestamp(
          cue.endMs
        )},${EXPORT_ASS_SUBTITLE_STYLE.name},,0,0,0,,${escapeAssText(cue.text)}`
    ),
    "",
  ].join("\n");
}

export function formatSrtTimestamp(totalMs: number): string {
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const milliseconds = totalMs % 1000;

  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":") + `,${milliseconds.toString().padStart(3, "0")}`;
}

export function formatAssTimestamp(totalMs: number): string {
  const centiseconds = Math.floor((totalMs % 1000) / 10);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);

  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

function buildAssStyleLine(): string {
  const style = EXPORT_ASS_SUBTITLE_STYLE;
  return [
    "Style:",
    [
      style.name,
      style.fontName,
      style.fontSize,
      style.primaryColor,
      style.secondaryColor,
      style.outlineColor,
      style.backColor,
      style.bold,
      style.italic,
      style.underline,
      style.strikeOut,
      style.scaleX,
      style.scaleY,
      style.spacing,
      style.angle,
      style.borderStyle,
      style.outline,
      style.shadow,
      style.alignment,
      style.marginL,
      style.marginR,
      style.marginV,
      style.encoding,
    ].join(","),
  ].join(" ");
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function pushChunks(cues: string[], text: string, maxCharsPerCue: number) {
  let remaining = text.trim();
  while (remaining.length > maxCharsPerCue) {
    cues.push(remaining.slice(0, maxCharsPerCue).trim());
    remaining = remaining.slice(maxCharsPerCue).trimStart();
  }
  if (remaining) {
    cues.push(remaining);
  }
}

function findLastSoftBreak(text: string): number {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (SOFT_BREAK_PATTERN.test(text[index])) {
      return index;
    }
  }
  return -1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
