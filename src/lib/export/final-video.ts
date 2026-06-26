import {
  EXPORT_OUTPUT_PROFILES,
} from "@/lib/export/constants";

export type ExportOutputProfile = keyof typeof EXPORT_OUTPUT_PROFILES;

export interface BuildFinalVideoFfmpegArgsInput {
  avatarVideoPath: string;
  audioPath: string;
  subtitlePath?: string | null;
  outputPath: string;
  outputProfile: ExportOutputProfile;
}

export function buildFinalVideoFfmpegArgs(
  input: BuildFinalVideoFfmpegArgsInput
): string[] {
  const profile = EXPORT_OUTPUT_PROFILES[input.outputProfile];
  const videoFilters = [`scale=${profile.width}:${profile.height}`];

  if (input.subtitlePath) {
    videoFilters.push(`subtitles='${escapeSubtitlePath(input.subtitlePath)}'`);
  }

  return [
    "-y",
    "-i",
    input.avatarVideoPath,
    "-i",
    input.audioPath,
    "-vf",
    videoFilters.join(","),
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-shortest",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outputPath,
  ];
}

function escapeSubtitlePath(path: string): string {
  return path.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
