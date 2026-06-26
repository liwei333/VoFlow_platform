import { mkdtemp, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  EXPORT_OUTPUT_PROFILES,
  EXPORT_REAL_MEDIA_SMOKE_DEFAULTS,
} from "@/lib/export/constants";
import type {
  FfprobeStream,
  FinalVideoValidationResult,
} from "@/lib/export/media-validation";
import { validateFinalVideoProbe } from "@/lib/export/media-validation";
import { buildFinalVideoFfmpegArgs } from "@/lib/export/final-video";
import { buildAssSubtitle } from "@/lib/export/subtitle";
import {
  executeFfmpegCommand,
  inspectMediaWithFfprobe,
  readFfmpegCommandOutput,
  resolveFfprobePath,
} from "@/services/exportFfmpegService";

type ExportOutputProfile = keyof typeof EXPORT_OUTPUT_PROFILES;

export interface RunRealMediaExportSmokeInput {
  ffmpegPath?: string;
  ffprobePath?: string;
  durationSeconds?: number;
  outputProfile?: ExportOutputProfile;
  cleanup?: boolean;
}

export interface RealMediaExportSmokeResult {
  validation: FinalVideoValidationResult;
  output: {
    sizeBytes: number;
    durationSeconds: number;
    width: number | null;
    height: number | null;
    hasVideoStream: boolean;
    hasAudioStream: boolean;
    subtitleBurned: boolean;
  };
}

export async function runRealMediaExportSmoke(
  input: RunRealMediaExportSmokeInput = {}
): Promise<RealMediaExportSmokeResult> {
  const ffmpegPath = input.ffmpegPath ?? process.env.FFMPEG_WORKER ?? "ffmpeg";
  const ffprobePath =
    input.ffprobePath ?? process.env.FFPROBE_WORKER ?? resolveFfprobePath(ffmpegPath);
  const durationSeconds =
    input.durationSeconds ?? EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.durationSeconds;
  const outputProfile = input.outputProfile ?? "mp4_1080p";
  const tempDir = await mkdtemp(path.join(tmpdir(), "voflow-export-smoke-"));
  const avatarVideoPath = path.join(tempDir, "avatar-input.mp4");
  const audioPath = path.join(tempDir, "voice-input.wav");
  const subtitlePath = path.join(tempDir, "subtitle.ass");
  const outputPath = path.join(tempDir, "final-video.mp4");

  try {
    const subtitleFilterSupported = await hasFfmpegFilter(ffmpegPath, "subtitles");
    await executeFfmpegCommand(
      ffmpegPath,
      buildSyntheticAvatarVideoArgs({
        outputPath: avatarVideoPath,
        durationSeconds,
      })
    );
    await executeFfmpegCommand(
      ffmpegPath,
      buildSyntheticAudioArgs({
        outputPath: audioPath,
        durationSeconds,
      })
    );
    if (subtitleFilterSupported) {
      await writeFile(
        subtitlePath,
        buildAssSubtitle(EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.subtitleText),
        "utf8"
      );
    }
    await executeFfmpegCommand(
      ffmpegPath,
      buildFinalVideoFfmpegArgs({
        avatarVideoPath,
        audioPath,
        subtitlePath: subtitleFilterSupported ? subtitlePath : null,
        outputPath,
        outputProfile,
      })
    );

    const fileStat = await stat(outputPath);
    const probe = await inspectMediaWithFfprobe(ffprobePath, outputPath);
    const validation = validateFinalVideoProbe({
      sizeBytes: fileStat.size,
      probe,
      expectedDurationSeconds: durationSeconds,
    });
    const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
    const audioStream = probe.streams?.find((stream) => stream.codec_type === "audio");

    return {
      validation,
      output: {
        sizeBytes: fileStat.size,
        durationSeconds: Number(probe.format?.duration ?? 0),
        width: readNumericStreamField(videoStream, "width"),
        height: readNumericStreamField(videoStream, "height"),
        hasVideoStream: Boolean(videoStream),
        hasAudioStream: Boolean(audioStream),
        subtitleBurned: subtitleFilterSupported,
      },
    };
  } finally {
    if (input.cleanup !== false) {
      await rm(tempDir, {
        recursive: true,
        force: true,
      });
    }
  }
}

async function hasFfmpegFilter(ffmpegPath: string, filterName: string): Promise<boolean> {
  const output = await readFfmpegCommandOutput(ffmpegPath, ["-hide_banner", "-filters"]);
  return output
    .split("\n")
    .some((line) => line.trim().split(/\s+/).includes(filterName));
}

function buildSyntheticAvatarVideoArgs(input: {
  outputPath: string;
  durationSeconds: number;
}): string[] {
  return [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=${EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.inputWidth}x${EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.inputHeight}:rate=${EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.frameRate}:duration=${input.durationSeconds}`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    input.outputPath,
  ];
}

function buildSyntheticAudioArgs(input: {
  outputPath: string;
  durationSeconds: number;
}): string[] {
  return [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${EXPORT_REAL_MEDIA_SMOKE_DEFAULTS.sineFrequencyHz}:duration=${input.durationSeconds}`,
    "-c:a",
    "pcm_s16le",
    input.outputPath,
  ];
}

function readNumericStreamField(
  stream: FfprobeStream | undefined,
  field: "width" | "height"
): number | null {
  const value = stream?.[field];
  return typeof value === "number" ? value : null;
}
